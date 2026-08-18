import { HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY } from "@virtool/storage";
import { StorageKeyNotFoundError } from "@virtool/storage/errors";
import { describe, expect, it } from "vitest";
import { createFakeSample, createFakeSubtraction } from "./builders";
import { createTestStorage } from "./storage";

async function readText(
	storage: ReturnType<typeof createTestStorage>["storage"],
	key: string,
): Promise<string> {
	const chunks: Uint8Array[] = [];

	for await (const chunk of storage.read(key)) {
		chunks.push(chunk);
	}

	return Buffer.concat(chunks).toString();
}

describe("minted keys", () => {
	it("returns the key it minted for the caller to attach to a fake row", async () => {
		const { storage, seedSampleReads } = createTestStorage();
		const sample = createFakeSample();

		const seeded = await seedSampleReads(sample.id, [
			{ name: "reads_1.fq.gz", contents: "one" },
			{ name: "reads_2.fq.gz", contents: "two" },
		]);

		expect(seeded).toHaveLength(2);

		for (const file of seeded) {
			expect(file.storageKey).toMatch(
				new RegExp(`^samples/${sample.id}/[0-9a-f]{32}$`),
			);
		}

		// The flow the harness exists to force: attach the returned key to the row
		// the jobs API fixture will serve, and the code under test reads it back
		// out of that metadata.
		const row = {
			...sample,
			reads: seeded.map((file, index) => ({
				id: index,
				name: file.name,
				size: file.size,
				storageKey: file.storageKey,
			})),
		};

		await expect(
			readText(storage, row.reads[0]?.storageKey ?? ""),
		).resolves.toBe("one");
	});

	// A shared key builder only catches a divergence between two builders. A
	// minted key is unguessable by construction, so a fixture that composes one —
	// or quietly falls back to a filename — finds nothing.
	it("cannot be guessed from the row id or the filename", async () => {
		const { storage, seedSubtractionFiles } = createTestStorage();
		const subtraction = createFakeSubtraction();

		await seedSubtractionFiles(subtraction.id, [
			{ name: "subtraction.fa.gz", contents: ">seq" },
		]);

		await expect(
			readText(storage, `subtractions/${subtraction.id}/subtraction.fa.gz`),
		).rejects.toThrow(StorageKeyNotFoundError);

		await expect(
			readText(storage, `subtractions/${subtraction.id}`),
		).rejects.toThrow(StorageKeyNotFoundError);
	});

	it("mints a different key for every file, even with the same name", async () => {
		const { seedSubtractionFiles } = createTestStorage();

		const [first, second] = await seedSubtractionFiles(1, [
			{ name: "same.fa", contents: "a" },
			{ name: "same.fa", contents: "b" },
		]);

		expect(first?.storageKey).not.toBe(second?.storageKey);
	});

	it("mints an upload's key without a parent id", async () => {
		const { seedUpload } = createTestStorage();

		const upload = await seedUpload("reads_1.fq.gz", "bytes");

		expect(upload.storageKey).toMatch(/^uploads\/[0-9a-f]{32}$/);
		expect(upload.size).toBe(5);
	});

	it("mints an index artifact's key", async () => {
		const { seedIndexArtifact } = createTestStorage();

		const artifact = await seedIndexArtifact(
			7,
			"reference-snapshot.v1.sqlite.gz",
			new Uint8Array([1, 2, 3]),
		);

		expect(artifact.storageKey).toMatch(/^indexes\/7\/[0-9a-f]{32}$/);
		expect(artifact.size).toBe(3);
	});
});

describe("legacy keys", () => {
	// A migrated row keeps whatever prefix its object was written under, so the
	// keys in the bucket are heterogeneous by design. A fixture that only ever
	// sees freshly minted keys would not notice code that assumed a shape.
	it("seeds an object under a prefix matching no current pattern", async () => {
		const { storage, seedAtKey } = createTestStorage();

		const legacy = await seedAtKey(
			"samples/5f2a1c9e8b4d3f7a/reads_1.fq.gz",
			"migrated",
		);

		expect(legacy.storageKey).toBe("samples/5f2a1c9e8b4d3f7a/reads_1.fq.gz");
		await expect(readText(storage, legacy.storageKey)).resolves.toBe(
			"migrated",
		);
	});
});

describe("HMM files", () => {
	// The exception: the HMM blobs live at two fixed keys, so nothing is minted.
	it("seeds the two blobs at their fixed keys", async () => {
		const { storage, seedHmmFiles } = createTestStorage();

		const { profiles, annotations } = await seedHmmFiles("HMMER3", "{}");

		expect(profiles.storageKey).toBe(HMM_PROFILES_KEY);
		expect(annotations.storageKey).toBe(HMM_ANNOTATIONS_KEY);

		await expect(readText(storage, HMM_PROFILES_KEY)).resolves.toBe("HMMER3");
	});
});
