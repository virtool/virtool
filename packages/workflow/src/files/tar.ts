/**
 * Tar reading and writing, ported from `virtool/workflow/data/tar.py`.
 *
 * Cache archives cross the runtime boundary in both directions — a TypeScript
 * workflow must read what Python's `tarfile` wrote, and Python must extract what
 * this writes — so the format is a contract, not an implementation detail.
 *
 * Archives are **uncompressed** (Python's `mode="w"`), so there is no compressor
 * variance to worry about. `tar-stream` is used rather than `node-tar` because
 * it is a pure stream parser: cache payloads are trimmed reads and Bowtie2
 * indexes, and nothing here may hold one in memory.
 *
 * ## Two deliberate divergences from Python
 *
 * **Extraction stages, then renames.** Python calls `getmembers()` to validate
 * the whole archive before extracting a byte, which is cheap for it because
 * `tarfile` seeks past data blocks on a seekable file. A stream parser cannot
 * seek, so the equivalent would mean reading a multi-gigabyte archive twice.
 * Entries are extracted into a staging directory alongside the target and
 * renamed into place only once the archive has validated, which gives the same
 * all-or-nothing guarantee in one pass.
 *
 * **Links and device nodes are rejected outright**, where Python's
 * `filter="data"` admits a symlink that stays inside the destination. Cache
 * payloads are regular files and directories, so the stricter rule costs
 * nothing and cannot silently restore a tree that points somewhere unintended.
 */

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { extract, pack } from "tar-stream";
import { TarArchiveError, TarTargetExistsError } from "../errors";

// Everything a `filter="data"` extraction refuses, plus the link types Python
// would admit conditionally. Anything not a file or a directory lands here.
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
	return name.replace(/^\/+/, "").split("/")[0];
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
