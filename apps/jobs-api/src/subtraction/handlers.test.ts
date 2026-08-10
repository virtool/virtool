import type { SubtractionFileManifest } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import {
	subtractionFiles,
	subtractions,
} from "@virtool/data/db/schema/subtractions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import {
	MemoryStorage,
	mintStorageKey,
	type StorageBackend,
} from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import {
	handleFinalizeSubtraction,
	handleGetSubtraction,
	type SubtractionHandlerDeps,
} from "./handlers";

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let deps: SubtractionHandlerDeps;
let credential: string;
let jobId: number;
let userId: number;

const logger = createLogger({ name: "test", level: "silent" });

const GC = { a: 0.25, c: 0.25, g: 0.25, t: 0.24, n: 0.01 };

/**
 * Storage reads and SQL statements on one timeline, which is what lets the
 * ordering test below assert that verification finishes before the transaction
 * opens rather than assuming it.
 */
const timeline: string[] = [];

beforeAll(async () => {
	database = await createTestDatabase({
		onQuery: (query) => timeline.push(`sql:${query}`),
	});
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(subtractionFiles);
	await db.delete(subtractions);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);

	const job = await seedJob(db, userId, {
		workflow: "create_subtraction",
	});

	jobId = job.id;
	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	storage = new MemoryStorage();
	deps = { db, storage: recording(storage), logger };
	timeline.length = 0;
});

/** The backend, with every `size` call noted on the shared timeline. */
function recording(backend: MemoryStorage): StorageBackend {
	return {
		read: (key) => backend.read(key),
		write: (key, data) => backend.write(key, data),
		delete: (key) => backend.delete(key),
		list: (prefix) => backend.list(prefix),
		size: async (key) => {
			timeline.push(`size:${key}`);
			return backend.size(key);
		},
	};
}

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

async function seedSubtraction(
	overrides: Partial<typeof subtractions.$inferInsert> = {},
): Promise<number> {
	const [row] = await db
		.insert(subtractions)
		.values({
			name: `Subtraction ${Math.random()}`,
			job_id: jobId,
			...overrides,
		})
		.returning({ id: subtractions.id });

	if (!row) {
		throw new Error("failed to seed subtraction");
	}

	return row.id;
}

function patch(
	subtractionId: number,
	payload: unknown,
	authenticated = true,
): Request {
	return new Request(
		`https://jobs.virtool.test/subtractions/${subtractionId}`,
		{
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				...(authenticated ? { authorization: `Basic ${credential}` } : {}),
			},
			body: JSON.stringify(payload),
		},
	);
}

/** A manifest entry for `name`, with its bytes already in the bucket. */
async function written(
	subtractionId: number,
	name: string,
	contents: string,
): Promise<SubtractionFileManifest> {
	const storageKey = mintStorageKey("subtractions", subtractionId);

	await storage.write(storageKey, body(contents));

	return { kind: "subtractionFile", name, storageKey };
}

function finalize(subtractionId: number, files: unknown[]) {
	return handleFinalizeSubtraction(
		deps,
		patch(subtractionId, { count: 12, gc: GC, files }),
		String(subtractionId),
	);
}

describe("handleFinalizeSubtraction", () => {
	it("refuses an unauthenticated caller", async () => {
		const subtractionId = await seedSubtraction();

		const response = await handleFinalizeSubtraction(
			deps,
			patch(subtractionId, { count: 12, gc: GC, files: [] }, false),
			String(subtractionId),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("records the file and flips the subtraction ready", async () => {
		const subtractionId = await seedSubtraction();

		const fasta = await written(
			subtractionId,
			"subtraction.fa.gz",
			"a genome!",
		);

		const response = await finalize(subtractionId, [fasta]);

		expect(response.status).toBe(200);

		const returned = await response.json();

		expect(returned.ready).toBe(true);
		expect(returned.count).toBe(12);
		expect(returned.gc).toStrictEqual(GC);

		const rows = await db
			.select()
			.from(subtractionFiles)
			.where(eq(subtractionFiles.subtraction_id, subtractionId));

		// The key is recorded byte for byte, not recomposed from the row.
		expect(
			rows.map(
				(row) => `${row.name}|${row.type}|${row.size}|${row.storage_key}`,
			),
		).toStrictEqual([`subtraction.fa.gz|fasta|9|${fasta.storageKey}`]);
	});

	// A subtraction with no source genome is not a usable subtraction, and the
	// parent must not flip ready over nothing.
	it("refuses an empty manifest", async () => {
		const subtractionId = await seedSubtraction();

		const response = await finalize(subtractionId, []);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: subtractions.ready })
			.from(subtractions)
			.where(eq(subtractions.id, subtractionId));

		expect(row?.ready).toBe(false);
	});

	// The shards are written by `create_subtraction` and read by nothing: both
	// analysis workflows build the bowtie2 index locally from the FASTA. The
	// write path stopped accepting them; the read path still serves the rows
	// Python left behind.
	it("refuses a bowtie2 shard", async () => {
		const subtractionId = await seedSubtraction();

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
			await written(subtractionId, "subtraction.1.bt2", "index"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	// One whitelisted name plus the duplicate check is what makes the FASTA
	// exactly-once; nothing else counts the manifest.
	it("refuses the FASTA declared twice", async () => {
		const subtractionId = await seedSubtraction();

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
			await written(subtractionId, "subtraction.fa.gz", "again"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("stores the size it read from storage, not one the caller sent", async () => {
		const subtractionId = await seedSubtraction();
		const file = await written(subtractionId, "subtraction.fa.gz", "a genome!");

		await finalize(subtractionId, [{ ...file, size: 999_999 }]);

		const [row] = await db.select().from(subtractionFiles);

		expect(row?.size).toBe(9);
	});

	it("answers 400 and writes nothing when a file names no stored object", async () => {
		const subtractionId = await seedSubtraction();

		const response = await finalize(subtractionId, [
			{
				kind: "subtractionFile",
				name: "subtraction.fa.gz",
				storageKey: mintStorageKey("subtractions", subtractionId),
			},
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: subtractions.ready, count: subtractions.count })
			.from(subtractions)
			.where(eq(subtractions.id, subtractionId));

		expect(row).toStrictEqual({ ready: false, count: null });
	});

	// The bytes really are in the bucket, under another subtraction's prefix, so
	// only the prefix check stands between this and a row that names them.
	it("refuses a key belonging to another subtraction", async () => {
		const subtractionId = await seedSubtraction();
		const otherId = await seedSubtraction({ job_id: null });

		const response = await finalize(subtractionId, [
			await written(otherId, "subtraction.fa.gz", "not yours"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("refuses a filename outside the whitelist", async () => {
		const subtractionId = await seedSubtraction();

		for (const name of ["subtraction.5.bt2", "../escape", "a/b.bt2"]) {
			const file = await written(subtractionId, "subtraction.fa.gz", "x");

			const response = await finalize(subtractionId, [{ ...file, name }]);

			expect(response.status).toBe(400);
		}

		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("answers 409 on a second finalize", async () => {
		const subtractionId = await seedSubtraction();
		const file = await written(subtractionId, "subtraction.fa.gz", "a genome!");

		expect((await finalize(subtractionId, [file])).status).toBe(200);

		const second = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(second.status).toBe(409);
		expect(await db.select().from(subtractionFiles)).toHaveLength(1);
	});

	// Every running job holds a valid credential, so without this check any one
	// of them could flip any subtraction ready and hang file rows off it.
	it("answers 403 for a subtraction another job produced", async () => {
		const other = await seedJob(db, userId, { workflow: "create_subtraction" });
		const subtractionId = await seedSubtraction({ job_id: other.id });

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(403);
		expect(await db.select().from(subtractionFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: subtractions.ready })
			.from(subtractions)
			.where(eq(subtractions.id, subtractionId));

		expect(row?.ready).toBe(false);
	});

	// A subtraction created before jobs, or by hand, is owned by nobody — which
	// is not the same as being owned by whoever asks.
	it("answers 403 for a subtraction no job produced", async () => {
		const subtractionId = await seedSubtraction({ job_id: null });

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(403);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	// 403 rather than 409: a subtraction a job does not own never reports its
	// state.
	it("answers 403, not 409, for a finalized subtraction another job produced", async () => {
		const other = await seedJob(db, userId, { workflow: "create_subtraction" });

		const subtractionId = await seedSubtraction({
			job_id: other.id,
			ready: true,
		});

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(403);
	});

	// 404 rather than 403: a deleted row is gone, and the ownership check never
	// gets to speak for it.
	it("answers 404, not 403, for a deleted subtraction another job produced", async () => {
		const other = await seedJob(db, userId, { workflow: "create_subtraction" });

		const subtractionId = await seedSubtraction({
			job_id: other.id,
			deleted: true,
		});

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(404);
	});

	it("answers 404 for a subtraction that does not exist", async () => {
		const response = await finalize(999_999, [
			await written(999_999, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(404);
	});

	it("answers 404 for a deleted subtraction", async () => {
		const subtractionId = await seedSubtraction({ deleted: true });

		const response = await finalize(subtractionId, [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		]);

		expect(response.status).toBe(404);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("answers 404 for an id that is not a row id", async () => {
		const response = await handleFinalizeSubtraction(
			deps,
			patch(1, { count: 12, gc: GC, files: [] }),
			"not-an-id",
		);

		expect(response.status).toBe(404);
	});

	it("answers 400 for a malformed body", async () => {
		const subtractionId = await seedSubtraction();

		const request = new Request(
			`https://jobs.virtool.test/subtractions/${subtractionId}`,
			{
				method: "PATCH",
				headers: {
					authorization: `Basic ${credential}`,
					"content-type": "application/json",
				},
				body: "{",
			},
		);

		const response = await handleFinalizeSubtraction(
			deps,
			request,
			String(subtractionId),
		);

		expect(response.status).toBe(400);
	});

	// A Mongo-migrated subtraction is addressed by its integer id like any other:
	// `subtraction_files.subtraction_id` is a NOT NULL foreign key and there is no
	// legacy string column to match through, unlike `sample_reads.sample`.
	it("finalizes a subtraction migrated out of Mongo", async () => {
		const subtractionId = await seedSubtraction({ legacy_id: "abc123" });
		const file = await written(subtractionId, "subtraction.fa.gz", "a genome!");

		expect((await finalize(subtractionId, [file])).status).toBe(200);

		const [row] = await db.select().from(subtractionFiles);

		expect(row?.storage_key).toBe(file.storageKey);
	});

	// Asserted rather than assumed. A size check that slipped inside the
	// transaction would hold a pool connection across a round trip to the bucket,
	// and a missing blob would then abort a transaction that had already written
	// rows.
	it("reads every size before the transaction opens", async () => {
		const subtractionId = await seedSubtraction();

		const files = [
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
		];

		// Seeding is not what is under test.
		timeline.length = 0;

		expect((await finalize(subtractionId, files)).status).toBe(200);

		const sizes = timeline.filter((entry) => entry.startsWith("size:"));
		const lastSize = timeline.findLastIndex((entry) =>
			entry.startsWith("size:"),
		);
		const begin = timeline.findIndex((entry) => /^sql:\s*begin\b/i.test(entry));

		expect(sizes).toHaveLength(1);
		expect(begin).toBeGreaterThan(-1);
		expect(lastSize).toBeLessThan(begin);
	});
});

function get(subtractionId: number | string, authenticated = true): Request {
	return new Request(
		`https://jobs.virtool.test/subtractions/${subtractionId}`,
		{ headers: authenticated ? { authorization: `Basic ${credential}` } : {} },
	);
}

describe("handleGetSubtraction", () => {
	it("serves the subtraction and its files", async () => {
		const subtractionId = await seedSubtraction({
			nickname: "Arabidopsis",
			ready: true,
			count: 12,
			gc: GC,
		});

		await db.insert(subtractionFiles).values({
			subtraction_id: subtractionId,
			name: "subtraction.fa.gz",
			size: 4096,
			storage_key: "subtractions/1/aaaabbbbccccddddeeeeffff00001111",
			type: "fasta",
		});

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId),
			String(subtractionId),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: subtractionId,
			count: 12,
			files: [
				{
					id: expect.any(Number),
					name: "subtraction.fa.gz",
					size: 4096,
					storageKey: "subtractions/1/aaaabbbbccccddddeeeeffff00001111",
					type: "fasta",
				},
			],
			gc: GC,
			name: expect.any(String),
			nickname: "Arabidopsis",
			ready: true,
		});
	});

	// The write path no longer accepts a bowtie2 shard, but every subtraction
	// Python finalized has six of them. They keep being served, `type` and all.
	it("serves the bowtie2 shards of a subtraction Python finalized", async () => {
		const subtractionId = await seedSubtraction({ ready: true });

		await db.insert(subtractionFiles).values([
			{
				subtraction_id: subtractionId,
				name: "subtraction.fa.gz",
				size: 4096,
				storage_key: "subtractions/1/aaaabbbbccccddddeeeeffff00001111",
				type: "fasta",
			},
			{
				subtraction_id: subtractionId,
				name: "subtraction.rev.2.bt2",
				size: 512,
				storage_key: "subtractions/1/22223333444455556666777788889999",
				type: "bowtie2",
			},
		]);

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId),
			String(subtractionId),
		);
		const subtraction = (await response.json()) as {
			files: { name: string; type: string }[];
		};

		expect(response.status).toBe(200);
		expect(
			subtraction.files.map((file) => `${file.name}|${file.type}`).sort(),
		).toStrictEqual([
			"subtraction.fa.gz|fasta",
			"subtraction.rev.2.bt2|bowtie2",
		]);
	});

	// The workflow reads the bytes itself and has no way to locate them but this
	// key. A migrated object keeps whatever prefix it was written under, so the
	// key here matches no pattern that could reconstruct it — if the handler ever
	// composed one instead of reading the column, this is the test that fails.
	it("returns a migrated file's recorded key verbatim", async () => {
		const subtractionId = await seedSubtraction();
		const legacyKey = "references/legacy-prefix/xyz/subtraction_1.fa.gz";

		await db.insert(subtractionFiles).values({
			subtraction_id: subtractionId,
			name: "subtraction.fa.gz",
			size: 8,
			storage_key: legacyKey,
			type: "fasta",
		});

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId),
			String(subtractionId),
		);
		const subtraction = (await response.json()) as {
			files: { storageKey: string }[];
		};

		expect(subtraction.files[0]?.storageKey).toBe(legacyKey);
	});

	// A row written before keys were recorded names no object. The workflow must
	// see the null and fail rather than be handed something it can guess with.
	it("reports a null key for a file that predates keys being recorded", async () => {
		const subtractionId = await seedSubtraction();

		await db.insert(subtractionFiles).values({
			subtraction_id: subtractionId,
			name: "subtraction.fa.gz",
			size: 8,
			type: "fasta",
		});

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId),
			String(subtractionId),
		);
		const subtraction = (await response.json()) as {
			files: { storageKey: string | null }[];
		};

		expect(subtraction.files[0]?.storageKey).toBeNull();
	});

	// The SPA reads the same data function, which returns `createdAt`,
	// `sampleCount`, and a `downloadUrl`. None of those belong on this wire.
	it("omits fields that only the SPA needs", async () => {
		const subtractionId = await seedSubtraction();

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId),
			String(subtractionId),
		);
		const rendered = await response.text();

		expect(rendered).not.toContain("downloadUrl");
		expect(rendered).not.toContain("createdAt");
		expect(rendered).not.toContain("sampleCount");
	});

	it("reports 404 for a subtraction that does not exist", async () => {
		const response = await handleGetSubtraction(deps, get(404_040), "404040");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Subtraction not found" });
	});

	it("reports 404 for an id that is not a positive integer", async () => {
		const response = await handleGetSubtraction(deps, get("latest"), "latest");

		expect(response.status).toBe(404);
	});

	it("refuses an unauthenticated request", async () => {
		const subtractionId = await seedSubtraction();

		const response = await handleGetSubtraction(
			deps,
			get(subtractionId, false),
			String(subtractionId),
		);

		expect(response.status).toBe(401);
	});
});
