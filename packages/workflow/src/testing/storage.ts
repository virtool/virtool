/**
 * `MemoryStorage` plus seeding helpers.
 *
 * Storage is faked at the **backend**, not at HTTP: `MemoryStorage` already
 * implements `StorageBackend` and workflows take the backend as an argument, so
 * there is nothing to intercept.
 *
 * ## Every helper mints its key and hands it back
 *
 * No helper composes a key from a row id, a legacy id, or a filename, because
 * nothing on either side of the real system does. A row records its complete key
 * and every read path reads that column, so the per-domain key builders this
 * harness was first sketched against no longer exist — `mintStorageKey`,
 * `mintRootStorageKey` and the two fixed HMM constants are all that is left.
 *
 * That makes this a **stronger** guarantee than seeding through shared builders.
 * A shared builder only catches a divergence between two builders; a minted key
 * is unguessable by construction, so a fixture that tries to compose one — or
 * quietly falls back to a filename — finds nothing and fails. The caller
 * attaches the returned key to the fake row the jobs API fixture will serve
 * (`reads[].storageKey`, `files[].storageKey`), and the code under test reads it
 * back out of that metadata, which is its only route to the bytes.
 *
 * `seedHmmFiles` is the exception: the HMM blobs live at two fixed keys, so it
 * uses those and returns them for symmetry rather than for lookup.
 */

import {
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	MemoryStorage,
	mintRootStorageKey,
	mintStorageKey,
} from "@virtool/storage";

/** Anything a seeding helper accepts as an object's contents. */
export type SeedContents = string | Uint8Array;

/** A file to seed, and the name the fake row will carry. */
export type SeedFile = {
	name: string;
	contents: SeedContents;
};

/** A seeded object: the name it is known by, and the key it actually lives at. */
export type SeededFile = {
	name: string;
	storageKey: string;
	size: number;
};

/** `MemoryStorage` with the seeding helpers a workflow fixture needs. */
export type TestStorage = {
	storage: MemoryStorage;

	/** Write `contents` at `key` exactly. For a legacy-shaped key a test supplies. */
	seedAtKey: (key: string, contents: SeedContents) => Promise<SeededFile>;

	/** One upload, under a root key — an upload is the resource, not a child of one. */
	seedUpload: (name: string, contents: SeedContents) => Promise<SeededFile>;

	seedSampleReads: (
		sampleId: number,
		files: readonly SeedFile[],
	) => Promise<SeededFile[]>;

	seedSubtractionFiles: (
		subtractionId: number,
		files: readonly SeedFile[],
	) => Promise<SeededFile[]>;

	seedIndexArtifact: (
		indexId: number,
		name: string,
		contents: SeedContents,
	) => Promise<SeededFile>;

	/** The two HMM blobs, at their two fixed keys. */
	seedHmmFiles: (
		profiles: SeedContents,
		annotations: SeedContents,
	) => Promise<{ profiles: SeededFile; annotations: SeededFile }>;
};

function toBytes(contents: SeedContents): Uint8Array {
	return typeof contents === "string"
		? new TextEncoder().encode(contents)
		: contents;
}

export function createTestStorage(): TestStorage {
	const storage = new MemoryStorage();

	async function write(
		name: string,
		key: string,
		contents: SeedContents,
	): Promise<SeededFile> {
		const bytes = toBytes(contents);

		const size = await storage.write(
			key,
			(async function* () {
				yield bytes;
			})(),
		);

		return { name, storageKey: key, size };
	}

	function seedMany(
		domain: string,
		parentId: number,
		files: readonly SeedFile[],
	): Promise<SeededFile[]> {
		return Promise.all(
			files.map((file) =>
				write(file.name, mintStorageKey(domain, parentId), file.contents),
			),
		);
	}

	return {
		storage,

		seedAtKey: (key, contents) =>
			write(key.split("/").pop() ?? key, key, contents),

		seedUpload: (name, contents) =>
			write(name, mintRootStorageKey("uploads"), contents),

		seedSampleReads: (sampleId, files) => seedMany("samples", sampleId, files),

		seedSubtractionFiles: (subtractionId, files) =>
			seedMany("subtractions", subtractionId, files),

		seedIndexArtifact: (indexId, name, contents) =>
			write(name, mintStorageKey("indexes", indexId), contents),

		async seedHmmFiles(profiles, annotations) {
			const [seededProfiles, seededAnnotations] = await Promise.all([
				write("profiles.hmm", HMM_PROFILES_KEY, profiles),
				write("annotations.json.gz", HMM_ANNOTATIONS_KEY, annotations),
			]);

			return { profiles: seededProfiles, annotations: seededAnnotations };
		},
	};
}
