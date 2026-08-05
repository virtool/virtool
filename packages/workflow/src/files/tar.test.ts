import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TarArchiveError, TarTargetExistsError } from "../errors";
import { extractTarToDir, writePathAsTar } from "./tar";

let workPath: string;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-tar-"));
});

afterEach(async () => {
	await rm(workPath, { recursive: true, force: true });
});

async function seedTree(root: string): Promise<void> {
	await mkdir(join(root, "nested"), { recursive: true });
	await writeFile(join(root, "reads_1.fq"), "@one\nACGT\n");
	await writeFile(join(root, "nested", "reads_2.fq"), "@two\nTGCA\n");
}

describe("writePathAsTar and extractTarToDir", () => {
	it("round-trips a directory tree", async () => {
		const source = join(workPath, "trimmed");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");

		await seedTree(source);
		await writePathAsTar(source, archive);

		const restored = await extractTarToDir(archive, target);

		expect(restored).toBe(join(target, "trimmed"));
		expect(await readFile(join(restored, "reads_1.fq"), "utf8")).toBe(
			"@one\nACGT\n",
		);
		expect(await readFile(join(restored, "nested", "reads_2.fq"), "utf8")).toBe(
			"@two\nTGCA\n",
		);
	});

	it("round-trips a single file", async () => {
		const source = join(workPath, "reads.fq");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");

		await writeFile(source, "@read\nACGT\n");
		await writePathAsTar(source, archive);

		const restored = await extractTarToDir(archive, target);

		expect(restored).toBe(join(target, "reads.fq"));
		expect(await readFile(restored, "utf8")).toBe("@read\nACGT\n");
	});

	// `arcname=source.name` in Python. A restored tree has to land at the same
	// relative path it was archived from, whatever directory it was archived in.
	it("names the top-level entry after the source's basename", async () => {
		const source = join(workPath, "deeply", "nested", "trimmed");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");

		await mkdir(source, { recursive: true });
		await writeFile(join(source, "a.fq"), "data");
		await writePathAsTar(source, archive);

		expect(await extractTarToDir(archive, target)).toBe(
			join(target, "trimmed"),
		);
	});

	it("round-trips a file larger than one chunk", async () => {
		const source = join(workPath, "big");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");
		const content = "ACGT".repeat(1024 * 1024);

		await mkdir(source, { recursive: true });
		await writeFile(join(source, "reads.fq"), content);
		await writePathAsTar(source, archive);

		const restored = await extractTarToDir(archive, target);

		expect(await readFile(join(restored, "reads.fq"), "utf8")).toBe(content);
	});

	it("creates the archive's parent directory", async () => {
		const source = join(workPath, "reads.fq");
		await writeFile(source, "data");

		await writePathAsTar(source, join(workPath, "a", "b", "cache.tar"));

		expect(
			await extractTarToDir(
				join(workPath, "a", "b", "cache.tar"),
				join(workPath, "restored"),
			),
		).toBe(join(workPath, "restored", "reads.fq"));
	});

	it("rejects a source that does not exist", async () => {
		await expect(
			writePathAsTar(join(workPath, "absent"), join(workPath, "cache.tar")),
		).rejects.toThrow(TarArchiveError);
	});

	// `stat` follows a symlinked root; `lstat` does not. Following one archives
	// whatever it points at, which can be a tree outside the work path entirely.
	it("refuses to archive a symlinked root", async () => {
		await mkdir(join(workPath, "outside"), { recursive: true });
		await writeFile(join(workPath, "outside", "secret.fq"), "data");
		await symlink(join(workPath, "outside"), join(workPath, "link"));

		await expect(
			writePathAsTar(join(workPath, "link"), join(workPath, "cache.tar")),
		).rejects.toThrow(TarArchiveError);
	});

	it("refuses to archive a symlink", async () => {
		const source = join(workPath, "tree");
		await mkdir(source, { recursive: true });
		await writeFile(join(workPath, "outside"), "data");
		await symlink(join(workPath, "outside"), join(source, "link"));

		await expect(
			writePathAsTar(source, join(workPath, "cache.tar")),
		).rejects.toThrow(TarArchiveError);
	});
});

describe("extractTarToDir guards", () => {
	// `pipe` does not forward a source error, so this used to surface as an
	// uncaught exception that took the process down instead of rejecting.
	it("rejects rather than crashing when the archive does not exist", async () => {
		await expect(
			extractTarToDir(join(workPath, "absent.tar"), join(workPath, "restored")),
		).rejects.toThrow(/ENOENT/);
	});

	it("rejects when the archive is not a tar at all", async () => {
		const archive = join(workPath, "not-a-tar");
		await writeFile(archive, "just some bytes");

		await expect(
			extractTarToDir(archive, join(workPath, "restored")),
		).rejects.toThrow();
	});

	it("refuses a target that already exists", async () => {
		const source = join(workPath, "trimmed");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");

		await seedTree(source);
		await writePathAsTar(source, archive);
		await mkdir(join(target, "trimmed"), { recursive: true });

		await expect(extractTarToDir(archive, target)).rejects.toThrow(
			TarTargetExistsError,
		);
	});

	it("refuses a target occupied by a dangling symlink", async () => {
		const source = join(workPath, "trimmed");
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");

		await seedTree(source);
		await writePathAsTar(source, archive);
		await mkdir(target, { recursive: true });
		await symlink(join(workPath, "nowhere"), join(target, "trimmed"));

		await expect(extractTarToDir(archive, target)).rejects.toThrow(
			TarTargetExistsError,
		);
	});

	it("refuses an archive with more than one top-level entry", async () => {
		const archive = join(workPath, "cache.tar");
		const { pack } = await import("tar-stream");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const archiveStream = pack();
		const written = pipeline(archiveStream, createWriteStream(archive));

		archiveStream.entry({ name: "first/a.fq" }, "one");
		archiveStream.entry({ name: "second/b.fq" }, "two");
		archiveStream.finalize();

		await written;

		await expect(
			extractTarToDir(archive, join(workPath, "restored")),
		).rejects.toThrow(/exactly one top-level entry/);
	});

	it("refuses an empty archive", async () => {
		const archive = join(workPath, "cache.tar");
		const { pack } = await import("tar-stream");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const archiveStream = pack();
		const written = pipeline(archiveStream, createWriteStream(archive));

		archiveStream.finalize();
		await written;

		await expect(
			extractTarToDir(archive, join(workPath, "restored")),
		).rejects.toThrow(/empty/);
	});

	it.each([
		["an absolute path", "/etc/passwd"],
		["a parent traversal", "trimmed/../../escaped"],
	])("refuses %s", async (_name, entryName) => {
		const archive = join(workPath, "cache.tar");
		const { pack } = await import("tar-stream");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const archiveStream = pack();
		const written = pipeline(archiveStream, createWriteStream(archive));

		archiveStream.entry({ name: entryName }, "payload");
		archiveStream.finalize();
		await written;

		await expect(
			extractTarToDir(archive, join(workPath, "restored")),
		).rejects.toThrow(TarArchiveError);
	});

	it("refuses a symlink member", async () => {
		const archive = join(workPath, "cache.tar");
		const { pack } = await import("tar-stream");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const archiveStream = pack();
		const written = pipeline(archiveStream, createWriteStream(archive));

		archiveStream
			.entry({ name: "trimmed/link", type: "symlink", linkname: "/etc/passwd" })
			.end();
		archiveStream.finalize();
		await written;

		await expect(
			extractTarToDir(archive, join(workPath, "restored")),
		).rejects.toThrow(TarArchiveError);
	});

	// The staging directory exists so a rejected archive leaves nothing behind.
	it("leaves the target untouched when extraction fails", async () => {
		const archive = join(workPath, "cache.tar");
		const target = join(workPath, "restored");
		const { pack } = await import("tar-stream");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");

		const archiveStream = pack();
		const written = pipeline(archiveStream, createWriteStream(archive));

		archiveStream.entry({ name: "first/a.fq" }, "one");
		archiveStream.entry({ name: "second/b.fq" }, "two");
		archiveStream.finalize();
		await written;

		await expect(extractTarToDir(archive, target)).rejects.toThrow(
			TarArchiveError,
		);

		const { readdir } = await import("node:fs/promises");

		expect(await readdir(target)).toStrictEqual([]);
	});
});
