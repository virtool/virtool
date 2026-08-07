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
	type SubtractionHandlerDeps,
} from "./handlers";

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let deps: SubtractionHandlerDeps;
let credential: string;

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

	const job = await seedJob(db, await seedUser(db), {
		workflow: "create_subtraction",
	});

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
		.values({ name: `Subtraction ${Math.random()}`, ...overrides })
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

	it("records the files and flips the subtraction ready", async () => {
		const subtractionId = await seedSubtraction();

		const fasta = await written(
			subtractionId,
			"subtraction.fa.gz",
			"a genome!",
		);
		const shard = await written(subtractionId, "subtraction.1.bt2", "index");

		const response = await finalize(subtractionId, [fasta, shard]);

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
			rows
				.map((row) => `${row.name}|${row.type}|${row.size}|${row.storage_key}`)
				.sort(),
		).toStrictEqual(
			[
				`subtraction.fa.gz|fasta|9|${fasta.storageKey}`,
				`subtraction.1.bt2|bowtie2|5|${shard.storageKey}`,
			].sort(),
		);
	});

	// The file type follows from the extension rather than the wire, so a `.bt2`
	// shard cannot be recorded as the FASTA the download page links to.
	it("derives the file type from the name", async () => {
		const subtractionId = await seedSubtraction();

		await finalize(subtractionId, [
			await written(subtractionId, "subtraction.rev.2.bt2", "x"),
		]);

		const [row] = await db.select().from(subtractionFiles);

		expect(row?.type).toBe("bowtie2");
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
			await written(subtractionId, "subtraction.fa.gz", "a genome!"),
			{
				kind: "subtractionFile",
				name: "subtraction.1.bt2",
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
		const otherId = await seedSubtraction();

		const response = await finalize(subtractionId, [
			await written(otherId, "subtraction.fa.gz", "not yours"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(subtractionFiles)).toEqual([]);
	});

	it("refuses a filename outside the seven-name whitelist", async () => {
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
			await written(subtractionId, "subtraction.1.bt2", "index"),
		]);

		expect(second.status).toBe(409);
		expect(await db.select().from(subtractionFiles)).toHaveLength(1);
	});

	it("answers 404 for a subtraction that does not exist", async () => {
		expect((await finalize(999_999, [])).status).toBe(404);
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
			await written(subtractionId, "subtraction.1.bt2", "index"),
		];

		// Seeding is not what is under test.
		timeline.length = 0;

		expect((await finalize(subtractionId, files)).status).toBe(200);

		const sizes = timeline.filter((entry) => entry.startsWith("size:"));
		const lastSize = timeline.findLastIndex((entry) =>
			entry.startsWith("size:"),
		);
		const begin = timeline.findIndex((entry) => /^sql:\s*begin\b/i.test(entry));

		expect(sizes).toHaveLength(2);
		expect(begin).toBeGreaterThan(-1);
		expect(lastSize).toBeLessThan(begin);
	});
});
