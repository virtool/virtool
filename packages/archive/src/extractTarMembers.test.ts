import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { pack } from "tar-stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TarArchiveError, TarMemberMissingError } from "./errors";
import { extractTarMembers } from "./tar";

let workPath: string;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-archive-"));
});

afterEach(async () => {
	await rm(workPath, { force: true, recursive: true });
});

type Member = {
	name: string;
	body?: string;
	type?: "directory" | "file" | "symlink";
};

/** Build a `.tar.gz` at `path` holding `members`, in the order given. */
async function writeArchive(path: string, members: Member[]): Promise<void> {
	const archive = pack();

	const written = pipeline(archive, createGzip(), async (source) => {
		const chunks: Buffer[] = [];
		for await (const chunk of source) {
			chunks.push(chunk as Buffer);
		}
		await writeFile(path, Buffer.concat(chunks));
	});

	for (const member of members) {
		if (member.type === "directory") {
			archive.entry({ name: member.name, type: "directory" }).end();
		} else if (member.type === "symlink") {
			archive
				.entry({ name: member.name, type: "symlink", linkname: "/etc/passwd" })
				.end();
		} else {
			archive.entry({ name: member.name }, member.body ?? "");
		}
	}

	archive.finalize();

	await written;
}

const ANNOTATIONS = "hmm/annotations.json";
const PROFILES = "hmm/profiles.hmm";

function targets() {
	return {
		[ANNOTATIONS]: join(workPath, "annotations.json"),
		[PROFILES]: join(workPath, "profiles.hmm"),
	};
}

describe("extractTarMembers", () => {
	it("extracts the named members to the paths given", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: ANNOTATIONS, body: "[]" },
			{ name: PROFILES, body: "HMMER3/f" },
		]);

		await extractTarMembers(archive, targets(), { gzip: true });

		expect(await readFile(join(workPath, "annotations.json"), "utf8")).toBe(
			"[]",
		);
		expect(await readFile(join(workPath, "profiles.hmm"), "utf8")).toBe(
			"HMMER3/f",
		);
	});

	// Entry order is a property of whoever packed the archive, and the install
	// needs annotations before profiles. Both orders must land identically.
	it.each([
		["annotations first", [ANNOTATIONS, PROFILES]],
		["profiles first", [PROFILES, ANNOTATIONS]],
	])("reads the same result with %s", async (_label, order) => {
		const archive = join(workPath, "hmm.tar.gz");

		const bodies: Record<string, string> = {
			[ANNOTATIONS]: '[{"cluster":2}]',
			[PROFILES]: "HMMER3/f profiles",
		};

		await writeArchive(
			archive,
			// biome-ignore lint/style/noNonNullAssertion: the map covers both names
			order.map((name) => ({ name, body: bodies[name]! })),
		);

		await extractTarMembers(archive, targets(), { gzip: true });

		expect(await readFile(join(workPath, "annotations.json"), "utf8")).toBe(
			'[{"cluster":2}]',
		);
		expect(await readFile(join(workPath, "profiles.hmm"), "utf8")).toBe(
			"HMMER3/f profiles",
		);
	});

	// The timeout is the assertion: an entry that is neither piped nor resumed
	// stalls `tar-stream` forever rather than failing.
	it("does not stall on entries it was not asked for", {
		timeout: 5000,
	}, async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: "hmm/", type: "directory" },
			{ name: "hmm/README.md", body: "not wanted" },
			{ name: ANNOTATIONS, body: "[]" },
			{ name: "hmm/extra.bin", body: "x".repeat(200_000) },
			{ name: PROFILES, body: "HMMER3/f" },
			{ name: "hmm/trailing.txt", body: "also not wanted" },
		]);

		await extractTarMembers(archive, targets(), { gzip: true });

		expect(await readFile(join(workPath, "profiles.hmm"), "utf8")).toBe(
			"HMMER3/f",
		);
	});

	it("rejects a member that escapes the archive root", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: ANNOTATIONS, body: "[]" },
			{ name: "hmm/../../evil", body: "pwned" },
			{ name: PROFILES, body: "HMMER3/f" },
		]);

		await expect(
			extractTarMembers(archive, targets(), { gzip: true }),
		).rejects.toThrow(TarArchiveError);
	});

	it("rejects an absolute member path", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [{ name: "/etc/passwd", body: "pwned" }]);

		await expect(
			extractTarMembers(archive, targets(), { gzip: true }),
		).rejects.toThrow(TarArchiveError);
	});

	it("rejects a non-regular member", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: ANNOTATIONS, body: "[]" },
			{ name: "hmm/link", type: "symlink" },
		]);

		await expect(
			extractTarMembers(archive, targets(), { gzip: true }),
		).rejects.toThrow(TarArchiveError);
	});

	it("reports a required member the archive does not carry", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [{ name: ANNOTATIONS, body: "[]" }]);

		await expect(
			extractTarMembers(archive, targets(), { gzip: true }),
		).rejects.toThrow(TarMemberMissingError);
	});

	it("allows a member named in `optional` to be absent", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [{ name: ANNOTATIONS, body: "[]" }]);

		await expect(
			extractTarMembers(archive, targets(), {
				gzip: true,
				optional: [PROFILES],
			}),
		).resolves.toBeUndefined();
	});

	it("rejects rather than crashing when the archive is not gzip", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeFile(archive, "<html>404 Not Found</html>");

		await expect(
			extractTarMembers(archive, targets(), { gzip: true }),
		).rejects.toThrow();
	});

	it("rejects when the archive does not exist", async () => {
		await expect(
			extractTarMembers(join(workPath, "absent.tar.gz"), targets(), {
				gzip: true,
			}),
		).rejects.toThrow();
	});

	it("reads an uncompressed archive when `gzip` is not set", async () => {
		const archive = join(workPath, "hmm.tar");
		const packer = pack();

		const collected = pipeline(packer, async (source) => {
			const chunks: Buffer[] = [];
			for await (const chunk of source) {
				chunks.push(chunk as Buffer);
			}
			await writeFile(archive, Buffer.concat(chunks));
		});

		packer.entry({ name: ANNOTATIONS }, "[]");
		packer.entry({ name: PROFILES }, "HMMER3/f");
		packer.finalize();

		await collected;

		await extractTarMembers(archive, targets());

		expect(await readFile(join(workPath, "annotations.json"), "utf8")).toBe(
			"[]",
		);
	});

	/*
	 * The signal is checked on every entry and not only where one is written.
	 * `pipeline` observes it for a wanted member, so an archive whose remaining
	 * entries are all skipped would otherwise drain to the end and resolve.
	 */
	it("stops when its signal aborts and every entry is skipped", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: "hmm/", type: "directory" },
			{ name: "hmm/README.md", body: "not wanted" },
		]);

		await expect(
			extractTarMembers(archive, targets(), {
				gzip: true,
				optional: [ANNOTATIONS, PROFILES],
				signal: AbortSignal.abort(),
			}),
		).rejects.toThrow();
	});

	it("stops when its signal aborts", async () => {
		const archive = join(workPath, "hmm.tar.gz");

		await writeArchive(archive, [
			{ name: ANNOTATIONS, body: "[]" },
			{ name: PROFILES, body: "HMMER3/f" },
		]);

		await expect(
			extractTarMembers(archive, targets(), {
				gzip: true,
				signal: AbortSignal.abort(),
			}),
		).rejects.toThrow();
	});
});
