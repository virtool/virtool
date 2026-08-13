/**
 * Tar reading and writing.
 *
 * The cache archives {@link extractTarToDir} and {@link writePathAsTar} handle
 * are also read and written by the Python runtime, so their format is a
 * contract. They are **uncompressed**, leaving no compressor variance to worry
 * about. {@link extractTarMembers} is the other shape: named members out of an
 * archive whose other contents are of no interest, and the one that takes gzip.
 *
 * `tar-stream` is used rather than `node-tar` because it is a pure stream
 * parser: payloads here are trimmed reads, Bowtie2 indexes and HMM profile
 * databases, and nothing may hold one in memory.
 *
 * ## Extraction stages, then renames
 *
 * A stream parser cannot seek, so validating the whole archive before writing a
 * byte would mean reading a multi-gigabyte file twice. Entries land in a
 * staging directory alongside the target and are renamed into place once the
 * archive has validated, which is all-or-nothing in one pass.
 *
 * ## Links and device nodes are rejected outright
 *
 * Payloads here are regular files and directories, so refusing everything else
 * costs nothing and cannot silently restore a tree that points somewhere
 * unintended.
 *
 * ## Every entry must be drained
 *
 * An entry that is neither piped nor `resume()`d **stalls the read forever** —
 * no error, no exit. Every path through every loop below pipes or resumes.
 */

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract, pack } from "tar-stream";
import {
	TarArchiveError,
	TarMemberMissingError,
	TarTargetExistsError,
} from "./errors";

// Anything that is not a plain file or a directory — links and device nodes
// included — is refused.
const ALLOWED_ENTRY_TYPES = new Set(["file", "directory"]);

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * The top-level entry name an archive member belongs to.
 *
 * Mirrors Python's `member.name.lstrip("/").split("/")[0]`.
 */
function topLevelNameOf(name: string): string {
	// `split` on a non-empty string always yields a first element; the fallback
	// is for the empty-name case, which `checkMemberIsSafe` rejects anyway.
	return name.replace(/^\/+/, "").split("/")[0] ?? "";
}

function checkMemberIsSafe(
	name: string,
	type: string | null | undefined,
): void {
	if (!ALLOWED_ENTRY_TYPES.has(type ?? "")) {
		throw new TarArchiveError(
			`refusing to extract ${name}: only files and directories are allowed, not ${type}`,
		);
	}

	if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) {
		throw new TarArchiveError(
			`refusing to extract ${name}: absolute paths are not allowed`,
		);
	}

	if (name.split("/").includes("..")) {
		throw new TarArchiveError(
			`refusing to extract ${name}: it escapes the destination directory`,
		);
	}
}

/**
 * Extract `archivePath` into `directory`, returning the path of the single
 * top-level entry it restored.
 *
 * @throws {TarArchiveError} when the archive is empty, holds more than one
 *   top-level entry, or holds a member that is not a plain file or directory.
 * @throws {TarTargetExistsError} when the top-level entry already exists.
 */
export async function extractTarToDir(
	archivePath: string,
	directory: string,
): Promise<string> {
	if ((await pathExists(directory)) && !(await stat(directory)).isDirectory()) {
		throw new TarArchiveError(`${directory} exists and is not a directory`);
	}

	await mkdir(directory, { recursive: true });

	const staging = join(directory, `.vt-extract-${randomUUID()}`);
	await mkdir(staging);

	let topLevel: string | null = null;

	try {
		const entries = extract();
		const source = createReadStream(archivePath);

		// `pipe` does not forward a source error to its destination, and an
		// `error` on a stream nothing listens to is an uncaught exception — so a
		// missing or unreadable archive would take the pod down rather than reject
		// this call, and the `ScaledJob` would retry a job that failed for a reason
		// the runtime never got to report. Destroying the extractor with the error
		// makes the loop below reject with it instead.
		source.on("error", (err) => entries.destroy(err));
		source.pipe(entries);

		for await (const entry of entries) {
			const { name, type } = entry.header;

			checkMemberIsSafe(name, type);

			const entryTopLevel = topLevelNameOf(name);

			if (topLevel === null) {
				topLevel = entryTopLevel;

				// Checked as soon as it is known, so a restore onto an occupied path
				// fails before it has written anything.
				await checkTargetIsFree(join(directory, topLevel));
			} else if (entryTopLevel !== topLevel) {
				throw new TarArchiveError(
					"tar archive must contain exactly one top-level entry",
				);
			}

			const target = join(staging, ...name.replace(/^\/+/, "").split("/"));

			if (type === "directory") {
				await mkdir(target, { recursive: true });
				entry.resume();
			} else {
				await mkdir(dirname(target), { recursive: true });
				await pipeline(entry, createWriteStream(target));
			}
		}

		if (topLevel === null) {
			throw new TarArchiveError("tar archive is empty");
		}

		const restored = join(directory, topLevel);

		await checkTargetIsFree(restored);
		await rename(join(staging, topLevel), restored);

		return restored;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

/** What {@link extractTarMembers} accepts alongside its member map. */
export type ExtractTarMembersOptions = {
	/** Pipe the archive through `createGunzip()` first. For a `.tar.gz`. */
	gzip?: boolean;
	/** Aborts the read between entries and destroys the stream. */
	signal?: AbortSignal;
	/** Members the archive may omit. Anything else in the map is required. */
	optional?: readonly string[];
};

/**
 * Extract named members of `archivePath` to the paths `members` maps them to.
 *
 * `members` is keyed by the member name as it appears in the archive; the caller
 * chooses every destination, so an archive never decides where a byte lands.
 * Parent directories are created and an existing destination is overwritten.
 *
 * **Every** entry is validated on the way past, wanted or not, matching Python's
 * `safely_extract_tgz`. Checking only what the caller asked for would let an
 * archive carry a payload the guard never looked at.
 *
 * @throws {TarArchiveError} when any member escapes the archive root or is not
 *   a plain file or directory.
 * @throws {TarMemberMissingError} when a required member is not in the archive.
 */
export async function extractTarMembers(
	archivePath: string,
	members: Readonly<Record<string, string>>,
	options: ExtractTarMembersOptions = {},
): Promise<void> {
	const { gzip = false, optional = [], signal } = options;

	const wanted = new Map(Object.entries(members));
	const found = new Set<string>();

	const entries = extract();
	const source = createReadStream(archivePath);

	// `pipe` does not forward a source error, and an unlistened `error` is an
	// uncaught exception — a missing archive would take the process down rather
	// than reject this call.
	source.on("error", (err) => entries.destroy(err));

	if (gzip) {
		const gunzip = createGunzip();
		gunzip.on("error", (err) => entries.destroy(err));
		source.pipe(gunzip).pipe(entries);
	} else {
		source.pipe(entries);
	}

	try {
		for await (const entry of entries) {
			// Every iteration, not only the ones that write: `pipeline` observes the
			// signal for a wanted member, but an archive whose tail is all skipped
			// entries would otherwise drain to the end and resolve during a drain.
			signal?.throwIfAborted();

			const { name, type } = entry.header;

			checkMemberIsSafe(name, type);

			const target = wanted.get(name);

			if (target === undefined || type === "directory") {
				// Resumed, not left alone: an undrained entry stalls the parser.
				entry.resume();
				continue;
			}

			await mkdir(dirname(target), { recursive: true });
			await pipeline(entry, createWriteStream(target), { signal });

			found.add(name);
		}
	} catch (err) {
		// Otherwise the handle behind `source` stays open until the archive has
		// been read to its end.
		source.destroy();
		entries.destroy();

		throw err;
	}

	const missing = [...wanted.keys()].filter(
		(name) => !found.has(name) && !optional.includes(name),
	);

	if (missing.length > 0) {
		throw new TarMemberMissingError(missing);
	}
}

async function checkTargetIsFree(path: string): Promise<void> {
	// `lstat` rather than `stat`: `stat` follows symlinks, so one dangling onto
	// nothing would read as free and be silently overwritten. Python guards the
	// same case with `exists() or is_symlink()`.
	try {
		await lstat(path);
	} catch {
		return;
	}

	throw new TarTargetExistsError(path);
}

async function* walk(
	root: string,
	arcname: string,
): AsyncGenerator<{ path: string; name: string; isDirectory: boolean }> {
	yield { path: root, name: arcname, isDirectory: true };

	// Sorted so an archive of the same tree is byte-stable, matching Python's
	// `TarFile.add`, which sorts each directory listing.
	const dirEntries = (await readdir(root, { withFileTypes: true })).sort(
		(left, right) => (left.name < right.name ? -1 : 1),
	);

	for (const dirEntry of dirEntries) {
		const path = join(root, dirEntry.name);
		const name = posix.join(arcname, dirEntry.name);

		if (dirEntry.isDirectory()) {
			yield* walk(path, name);
		} else if (dirEntry.isFile()) {
			yield { path, name, isDirectory: false };
		} else {
			throw new TarArchiveError(
				`refusing to archive ${path}: only files and directories can be cached`,
			);
		}
	}
}

/**
 * Write the file or directory at `source` into an uncompressed tar at
 * `archivePath`.
 *
 * The single top-level entry is named after `source`'s basename — Python's
 * `arcname=source.name` — so a restored tree lands at the same relative path it
 * was archived from.
 *
 * @throws {TarArchiveError} when `source` is neither a file nor a directory.
 */
export async function writePathAsTar(
	source: string,
	archivePath: string,
): Promise<void> {
	// `lstat`, not `stat`: `stat` follows a symlinked root and archives whatever
	// it points at, which can pull a tree in from outside the work path. `walk`
	// already refuses a nested link, and the root is held to the same rule.
	const info = await lstat(source).catch(() => null);

	if (info === null || (!info.isFile() && !info.isDirectory())) {
		throw new TarArchiveError(`${source} is neither a file nor a directory`);
	}

	await mkdir(dirname(archivePath), { recursive: true });

	const archive = pack();
	const written = pipeline(archive, createWriteStream(archivePath));
	const arcname = source.split(sep).filter(Boolean).at(-1) ?? source;

	try {
		if (info.isFile()) {
			await packFile(archive, source, arcname, info.size, info.mode);
		} else {
			for await (const member of walk(source, arcname)) {
				if (member.isDirectory) {
					archive.entry({ name: `${member.name}/`, type: "directory" }).end();
				} else {
					const memberInfo = await stat(member.path);

					await packFile(
						archive,
						member.path,
						member.name,
						memberInfo.size,
						memberInfo.mode,
					);
				}
			}
		}

		archive.finalize();
	} catch (err) {
		archive.destroy();

		// Destroying the pack stream makes `written` reject with a premature
		// close. That is a consequence of the failure being thrown here, not a
		// second failure, and leaving it unobserved would surface as an unhandled
		// rejection that outlives this call.
		await written.catch(() => {});

		throw err;
	}

	await written;
}

async function packFile(
	archive: ReturnType<typeof pack>,
	path: string,
	name: string,
	size: number,
	mode: number,
): Promise<void> {
	// Masked to the permission bits: setuid and setgid are exactly what Python's
	// `filter="data"` strips, and an archive carrying them would be rewritten on
	// the way out rather than extracted as sent.
	const entry = archive.entry({ name, size, mode: mode & 0o777 });

	await pipeline(createReadStream(path), entry);
}
