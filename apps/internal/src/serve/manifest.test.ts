import { MemoryStorage } from "@virtool/storage";
import { describe, expect, it } from "vitest";
import {
	checkManifest,
	isPlainFileName,
	isStorageKeyUnder,
	measureManifest,
} from "./manifest";

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

const PREFIX = "subtractions/7/";
const KEY = `${PREFIX}0f1e2d3c4b5a69788796a5b4c3d2e1f0`;

describe("isStorageKeyUnder", () => {
	it("accepts a key minted for this resource", () => {
		expect(isStorageKeyUnder(KEY, PREFIX)).toBe(true);
	});

	// The whole point of the check: a job-authenticated caller must not be able to
	// register a row pointing at another resource's object, which the delete paths
	// would then destroy on its behalf.
	it("rejects a key belonging to another resource", () => {
		expect(isStorageKeyUnder("subtractions/8/abc", PREFIX)).toBe(false);
		expect(isStorageKeyUnder("samples/7/abc", PREFIX)).toBe(false);
		expect(isStorageKeyUnder("caches/v1/abc", PREFIX)).toBe(false);
	});

	// `subtractions/7` must not open `subtractions/70`.
	it("rejects a sibling prefix that merely starts the same way", () => {
		expect(isStorageKeyUnder("subtractions/70/abc", PREFIX)).toBe(false);
	});

	it("rejects the bare prefix with nothing under it", () => {
		expect(isStorageKeyUnder(PREFIX, PREFIX)).toBe(false);
	});

	it("rejects a traversal back out of the prefix", () => {
		expect(isStorageKeyUnder(`${PREFIX}../../samples/1/reads`, PREFIX)).toBe(
			false,
		);
	});

	it("rejects an empty segment", () => {
		expect(isStorageKeyUnder(`${PREFIX}a//b`, PREFIX)).toBe(false);
	});

	it("rejects a leading slash", () => {
		expect(isStorageKeyUnder(`/${KEY}`, PREFIX)).toBe(false);
	});

	it("rejects an empty key", () => {
		expect(isStorageKeyUnder("", PREFIX)).toBe(false);
	});
});

describe("isPlainFileName", () => {
	it("accepts an ordinary name", () => {
		expect(isPlainFileName("subtraction.fa.gz")).toBe(true);
	});

	it("rejects a separator or a traversal", () => {
		for (const name of ["", "..", ".", "a/b", "../a", "/a"]) {
			expect(isPlainFileName(name)).toBe(false);
		}
	});
});

describe("checkManifest", () => {
	const entry = { name: "subtraction.fa.gz", storageKey: KEY };

	it("passes a well-formed manifest", () => {
		expect(checkManifest([entry], PREFIX, ["subtraction.fa.gz"])).toBeNull();
	});

	it("passes an empty manifest", () => {
		expect(checkManifest([], PREFIX, ["subtraction.fa.gz"])).toBeNull();
	});

	it("refuses a name outside the whitelist", () => {
		expect(
			checkManifest([{ ...entry, name: "subtraction.5.bt2" }], PREFIX, [
				"subtraction.fa.gz",
			]),
		).toMatch(/Unsupported file name/);
	});

	it("accepts any plain name when there is no whitelist", () => {
		expect(checkManifest([{ ...entry, name: "hmm.tsv" }], PREFIX, null)).toBe(
			null,
		);
	});

	it("refuses a key outside the prefix", () => {
		expect(
			checkManifest([{ ...entry, storageKey: "samples/7/abc" }], PREFIX, null),
		).toMatch(/not under/);
	});

	// Left to the unique constraints these would come back as a 500 on what is
	// plainly a malformed request.
	it("refuses a repeated name", () => {
		expect(
			checkManifest(
				[entry, { ...entry, storageKey: `${PREFIX}other` }],
				PREFIX,
				null,
			),
		).toMatch(/Duplicate file name/);
	});

	it("refuses a repeated storage key", () => {
		expect(
			checkManifest([entry, { ...entry, name: "other.bt2" }], PREFIX, null),
		).toMatch(/Duplicate storage key/);
	});
});

describe("measureManifest", () => {
	it("pairs each entry with the size storage reports", async () => {
		const storage = new MemoryStorage();
		await storage.write(KEY, body("hello world!"));

		const measured = await measureManifest(storage, [
			{ name: "subtraction.fa.gz", storageKey: KEY },
		]);

		expect(measured).toStrictEqual([
			{ name: "subtraction.fa.gz", storageKey: KEY, size: 12 },
		]);
	});

	it("reports null when one entry names no object", async () => {
		const storage = new MemoryStorage();
		await storage.write(KEY, body("hello world!"));

		const measured = await measureManifest(storage, [
			{ name: "subtraction.fa.gz", storageKey: KEY },
			{ name: "subtraction.1.bt2", storageKey: `${PREFIX}missing` },
		]);

		expect(measured).toBeNull();
	});
});
