import { gunzipSync } from "node:zlib";
import { MemoryStorage } from "@virtool/storage";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { legacyHistory } from "../db/schema/history";
import { indexes, indexFiles } from "../db/schema/indexes";
import { legacyOtus } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { tasks } from "../db/schema/tasks";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import {
	generateTaskIndex,
	IndexBuildTypeError,
	IndexManifestError,
	IndexNotFoundError,
} from "./data";
import { seedReference } from "./test/fixtures";

const ARTIFACT = "reference-v2.json.gz";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(indexFiles);
	await db.delete(legacyHistory);
	await db.delete(legacyOtus);
	await db.delete(indexes);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(users);
});

let handleCounter = 0;

async function seedNextUser(): Promise<number> {
	handleCounter += 1;

	return seedUser(db, { handle: `builder${handleCounter}` });
}

async function seedTask(): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(tasks)
			.values({
				complete: false,
				context: {},
				count: 0,
				created_at: new Date(),
				progress: 0,
				step: "build_index",
				type: "create_index",
			})
			.returning({ id: tasks.id }),
	).id;
}

// OTU ids are the 8-character Mongo id, so a seeder mints them. `data` is the
// verbatim Mongo document the artifact is built from, so it carries `isolates`
// — a document without one is malformed and never reaches a join.
async function seedOtus(
	referenceId: number,
	otus: { id: string; version: number }[],
): Promise<void> {
	await db.insert(legacyOtus).values(
		otus.map(({ id, version }) => ({
			id,
			data: {
				_id: id,
				name: `OTU ${id}`,
				isolates: [{ id: `iso_${id}`, source_type: "isolate" }],
				version,
			},
			name: `OTU ${id}`,
			abbreviation: "",
			reference_id: referenceId,
			verified: true,
			version,
		})),
	);
}

// `storage_key` is unique on `indexes` and is dead — nothing composes a key from
// it. Each seeded build gets one anyway, and it is deliberately unlike the row
// id so a write derived from either is distinguishable from a minted key.
let slugCounter = 0;

async function seedBuild(values: {
	referenceId: number;
	userId: number;
	manifest: Record<string, number>;
	ready?: boolean;
	backing?: "task" | "job" | "neither";
}): Promise<number> {
	slugCounter += 1;

	const backing = values.backing ?? "task";

	return takeFirstOrThrow(
		await db
			.insert(indexes)
			.values({
				created_at: new Date(),
				manifest: values.manifest,
				ready: values.ready ?? false,
				reference_id: values.referenceId,
				storage_key: `5f9a${slugCounter}legacymongoslug`,
				user_id: values.userId,
				version: 0,
				job_id: backing === "job" ? 4242 : null,
				task_id: backing === "task" ? await seedTask() : null,
			})
			.returning({ id: indexes.id }),
	).id;
}

/** A reference with one OTU pinned at its live version, ready to build. */
async function seedBuildable(): Promise<{
	referenceId: number;
	indexId: number;
	otuId: string;
}> {
	const userId = await seedNextUser();
	const referenceId = await seedReference(db, userId);

	await seedOtus(referenceId, [{ id: "otualpha", version: 4 }]);

	const indexId = await seedBuild({
		referenceId,
		userId,
		manifest: { otualpha: 4 },
	});

	return { referenceId, indexId, otuId: "otualpha" };
}

async function readFileRow(indexId: number) {
	const [row] = await db
		.select()
		.from(indexFiles)
		.where(eq(indexFiles.index_id, indexId));

	return row;
}

async function readArtifact(storage: MemoryStorage, key: string) {
	const parts: Uint8Array[] = [];

	for await (const part of storage.read(key)) {
		parts.push(part);
	}

	return JSON.parse(gunzipSync(Buffer.concat(parts)).toString()) as {
		_id: number;
		created_at: string;
		data_type: string;
		name: string;
		organism: string;
		otus: { _id: string }[];
	};
}

async function listKeys(storage: MemoryStorage): Promise<string[]> {
	const keys: string[] = [];

	for await (const object of storage.list("")) {
		keys.push(object.key);
	}

	return keys.sort();
}

describe("generateTaskIndex", () => {
	it("registers the artifact under a minted key and marks the build ready", async () => {
		const storage = new MemoryStorage();
		const { indexId } = await seedBuildable();

		const [before] = await db
			.select({ slug: indexes.storage_key })
			.from(indexes)
			.where(eq(indexes.id, indexId));

		await generateTaskIndex(db, storage, testLogger, indexId);

		const file = await readFileRow(indexId);

		expect(file).toMatchObject({
			index: String(indexId),
			index_id: indexId,
			name: ARTIFACT,
			type: "json",
		});
		expect(file?.size).toBeGreaterThan(0);

		// The key is minted, so it is derived from neither the row id nor the dead
		// `indexes.storage_key` slug. Both are checked because a helper named for
		// either would produce a key that reads nothing and orphans what it writes.
		expect(file?.storage_key).toMatch(/^indexes\/\d+\/[0-9a-f]{32}$/);
		expect(file?.storage_key).not.toContain(before?.slug);

		// The whole bucket, so a write to a second key cannot go unnoticed.
		expect(await listKeys(storage)).toEqual([file?.storage_key]);

		const [row] = await db
			.select({ ready: indexes.ready })
			.from(indexes)
			.where(eq(indexes.id, indexId));

		expect(row?.ready).toBe(true);
	});

	it("writes the envelope and OTUs Python writes", async () => {
		const storage = new MemoryStorage();
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId, { name: "Plants" });

		// Equal-length ids, so the JSONB manifest's key order — length, then
		// bytewise — is the insertion order and the expectation can be written out.
		await seedOtus(referenceId, [
			{ id: "otualpha", version: 1 },
			{ id: "otubetaa", version: 2 },
		]);

		const indexId = await seedBuild({
			referenceId,
			userId,
			manifest: { otualpha: 1, otubetaa: 2 },
		});

		await generateTaskIndex(db, storage, testLogger, indexId);

		const file = await readFileRow(indexId);
		const artifact = await readArtifact(storage, file?.storage_key ?? "");

		expect(artifact).toMatchObject({
			_id: referenceId,
			data_type: "genome",
			name: "Plants",
			organism: "virus",
		});
		expect(artifact.otus).toHaveLength(2);
		expect(artifact.otus.map((otu) => otu._id)).toEqual([
			"otualpha",
			"otubetaa",
		]);
	});

	// `JSON.parse` hoists array-index-like keys to the front of an object and
	// sorts them numerically, and an eight-character id drawn from digits and
	// lowercase letters is all digits often enough that a real reference has one.
	// Python iterates the manifest in JSONB order, and the artifact's OTU order
	// decides which isolate `cd-hit-est` keeps, so the two must agree.
	it("orders OTUs by the manifest's stored order, not by parsed key order", async () => {
		const storage = new MemoryStorage();
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);

		await seedOtus(referenceId, [
			{ id: "zzzzzzzz", version: 1 },
			{ id: "12345678", version: 1 },
			{ id: "aaaaaaaa", version: 1 },
		]);

		const indexId = await seedBuild({
			referenceId,
			userId,
			manifest: { zzzzzzzz: 1, "12345678": 1, aaaaaaaa: 1 },
		});

		const [stored] = await db
			.select({
				order: sql<string[]>`array(select jsonb_object_keys(manifest))`,
			})
			.from(indexes)
			.where(eq(indexes.id, indexId));

		await generateTaskIndex(db, storage, testLogger, indexId);

		const file = await readFileRow(indexId);
		const artifact = await readArtifact(storage, file?.storage_key ?? "");

		expect(artifact.otus.map((otu) => otu._id)).toEqual(stored?.order);

		// The hazard itself: a parsed object puts the numeric id first, and the
		// artifact must not.
		expect(Object.keys({ zzzzzzzz: 1, "12345678": 1, aaaaaaaa: 1 })[0]).toBe(
			"12345678",
		);
	});

	// orjson writes six fractional digits or, with no microseconds, none.
	// `Date.toISOString` always writes exactly three and has already truncated the
	// other three, and postgres.js parses a naive timestamp as local time. The
	// string is asserted rather than a parsed `Date` because it is the string that
	// lands in a file workflows read.
	it.each([
		["2026-01-02 03:04:05.123456", "2026-01-02T03:04:05.123456Z"],
		["2026-01-02 03:04:05", "2026-01-02T03:04:05Z"],
		["2026-01-02 03:04:05.000900", "2026-01-02T03:04:05.000900Z"],
	])("serializes created_at %s as %s", async (stored, expected) => {
		const storage = new MemoryStorage();
		const { indexId, referenceId } = await seedBuildable();

		await db.execute(
			sql`update legacy_references set created_at = ${stored}::timestamp where id = ${referenceId}`,
		);

		await generateTaskIndex(db, storage, testLogger, indexId);

		const file = await readFileRow(indexId);

		expect(
			(await readArtifact(storage, file?.storage_key ?? "")).created_at,
		).toBe(expected);
	});

	it("stamps last_indexed_version in the column and in data, across the chunk boundary", async () => {
		const storage = new MemoryStorage();
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);

		// 600 OTUs, so the patch loop runs two chunks and the stamp runs two
		// statements. `OTU_ID_CHUNK_SIZE` is 500.
		const otus = Array.from({ length: 600 }, (_, index) => ({
			id: `otu${String(index).padStart(5, "0")}`,
			version: 3,
		}));

		await seedOtus(referenceId, otus);

		const manifest: Record<string, number> = {};

		for (const otu of otus) {
			manifest[otu.id] = otu.version;
		}

		const indexId = await seedBuild({ referenceId, userId, manifest });

		await generateTaskIndex(db, storage, testLogger, indexId);

		const rows = await db
			.select({
				column: legacyOtus.last_indexed_version,
				inData: sql<string>`${legacyOtus.data} ->> 'last_indexed_version'`,
			})
			.from(legacyOtus)
			.where(eq(legacyOtus.reference_id, referenceId));

		expect(rows).toHaveLength(600);
		expect(rows.every((row) => row.column === 3)).toBe(true);
		expect(rows.every((row) => row.inData === "3")).toBe(true);
	});

	it("reports progress on chunk boundaries", async () => {
		const storage = new MemoryStorage();
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);

		const otus = Array.from({ length: 600 }, (_, index) => ({
			id: `otu${String(index).padStart(5, "0")}`,
			version: 1,
		}));

		await seedOtus(referenceId, otus);

		const manifest: Record<string, number> = {};

		for (const otu of otus) {
			manifest[otu.id] = otu.version;
		}

		const indexId = await seedBuild({ referenceId, userId, manifest });

		const reported: number[] = [];

		await generateTaskIndex(
			db,
			storage,
			testLogger,
			indexId,
			async (percent) => {
				reported.push(percent);
			},
		);

		expect(reported).toEqual([(500 / 600) * 100, 100]);
	});

	// A rebuild mints a new key rather than overwriting, so the row is repointed
	// and the object it replaced is deleted once the write that orphaned it has
	// committed.
	it("upserts one file row across a rebuild and deletes the superseded object", async () => {
		const storage = new MemoryStorage();
		const { indexId } = await seedBuildable();

		await generateTaskIndex(db, storage, testLogger, indexId);

		const first = await readFileRow(indexId);

		// A rebuild of the same build; the ready guard would otherwise no-op it.
		await db
			.update(indexes)
			.set({ ready: false })
			.where(eq(indexes.id, indexId));

		await generateTaskIndex(db, storage, testLogger, indexId);

		const second = await readFileRow(indexId);

		const rows = await db
			.select()
			.from(indexFiles)
			.where(eq(indexFiles.index_id, indexId));

		expect(rows).toHaveLength(1);
		expect(second?.id).toBe(first?.id);
		expect(second?.storage_key).not.toBe(first?.storage_key);
		expect(await listKeys(storage)).toEqual([second?.storage_key]);
	});

	// A claim is a lease, so a body may re-run from step zero after its work has
	// already committed. Python raises here, which would fail the task and show an
	// error against an index that is perfectly fine.
	it("is a successful no-op when the build is already ready", async () => {
		const storage = new MemoryStorage();
		const { indexId } = await seedBuildable();

		await generateTaskIndex(db, storage, testLogger, indexId);

		const file = await readFileRow(indexId);

		await expect(
			generateTaskIndex(db, storage, testLogger, indexId),
		).resolves.toBeUndefined();

		expect(await readFileRow(indexId)).toEqual(file);
		expect(await listKeys(storage)).toEqual([file?.storage_key]);
	});

	it("refuses a build that does not exist", async () => {
		await expect(
			generateTaskIndex(db, new MemoryStorage(), testLogger, 987654),
		).rejects.toThrow(IndexNotFoundError);
	});

	it("refuses a job-backed build", async () => {
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);
		const indexId = await seedBuild({
			referenceId,
			userId,
			manifest: {},
			backing: "job",
		});

		await expect(
			generateTaskIndex(db, new MemoryStorage(), testLogger, indexId),
		).rejects.toThrow("Index must be backed by a task build");
	});

	it("refuses a build backed by neither a job nor a task", async () => {
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);
		const indexId = await seedBuild({
			referenceId,
			userId,
			manifest: {},
			backing: "neither",
		});

		await expect(
			generateTaskIndex(db, new MemoryStorage(), testLogger, indexId),
		).rejects.toThrow(IndexBuildTypeError);
	});

	// A manifest entry is proof the OTU existed at that version, so a null is a
	// corrupted manifest. The build must fail rather than publish an artifact with
	// a hole in it, and the half-written object must not be registered.
	it("fails the build when a manifest entry cannot be patched", async () => {
		const storage = new MemoryStorage();
		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);

		await seedOtus(referenceId, [{ id: "otualpha", version: 1 }]);

		const indexId = await seedBuild({
			referenceId,
			userId,
			manifest: { otualpha: 1, otughost: 2 },
		});

		await expect(
			generateTaskIndex(db, storage, testLogger, indexId),
		).rejects.toThrow(IndexManifestError);

		expect(await readFileRow(indexId)).toBeUndefined();

		const [row] = await db
			.select({ ready: indexes.ready })
			.from(indexes)
			.where(eq(indexes.id, indexId));

		expect(row?.ready).toBe(false);
	});

	// The bound on memory is the chunk size, not the reference. Asserted on the
	// shape — one batched read per chunk, and bytes handed to storage as a stream
	// rather than a buffer — because the bytes themselves cannot show it.
	it("patches one chunk at a time and streams the artifact", async () => {
		const storage = new MemoryStorage();
		const write = vi.spyOn(storage, "write");

		const userId = await seedNextUser();
		const referenceId = await seedReference(db, userId);

		const otus = Array.from({ length: 1200 }, (_, index) => ({
			id: `otu${String(index).padStart(5, "0")}`,
			version: 1,
		}));

		await seedOtus(referenceId, otus);

		const manifest: Record<string, number> = {};

		for (const otu of otus) {
			manifest[otu.id] = otu.version;
		}

		const indexId = await seedBuild({ referenceId, userId, manifest });

		const chunkSizes: number[] = [];

		await generateTaskIndex(
			db,
			storage,
			testLogger,
			indexId,
			async (percent) => {
				chunkSizes.push(percent);
			},
		);

		// Three chunks of 500, 500 and 200 rather than one read of 1200.
		expect(chunkSizes).toHaveLength(3);

		const data = write.mock.calls[0]?.[1];

		expect(data).toBeDefined();
		expect(Symbol.asyncIterator in Object(data)).toBe(true);
		expect(Buffer.isBuffer(data)).toBe(false);

		const artifact = await readArtifact(
			storage,
			(await readFileRow(indexId))?.storage_key ?? "",
		);

		expect(artifact.otus).toHaveLength(1200);
	});
});
