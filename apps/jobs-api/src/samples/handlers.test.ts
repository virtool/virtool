import type { Quality, SampleReadManifest } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import {
	legacySamples,
	sampleReads,
	sampleUploads,
} from "@virtool/data/db/schema/samples";
import { uploads } from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import {
	MemoryStorage,
	mintRootStorageKey,
	mintStorageKey,
} from "@virtool/storage";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import {
	handleFinalizeSample,
	handleGetSample,
	type SampleHandlerDeps,
} from "./handlers";

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let deps: SampleHandlerDeps;
let credential: string;
let jobId: number;
let userId: number;

const logger = createLogger({ name: "test", level: "silent" });

const QUALITY: Quality = {
	bases: [[30, 31, 32, 33, 34]],
	composition: [[25, 25, 25, 25]],
	count: 1000,
	encoding: "Sanger",
	gc: 0.42,
	length: [100, 100],
	sequences: [1, 2, 3],
};

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(sampleReads);
	await db.delete(sampleUploads);
	await db.delete(legacySamples);
	await db.delete(uploads);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);

	const job = await seedJob(db, userId, { workflow: "create_sample" });

	jobId = job.id;
	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	storage = new MemoryStorage();
	deps = { db, storage, logger };
});

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

async function seedSample(
	overrides: Partial<typeof legacySamples.$inferInsert> = {},
): Promise<number> {
	const [row] = await db
		.insert(legacySamples)
		.values({
			name: `Sample ${Math.random()}`,
			library_type: "normal",
			created_at: new Date(),
			user_id: userId,
			job_id: jobId,
			...overrides,
		})
		.returning({ id: legacySamples.id });

	if (!row) {
		throw new Error("failed to seed sample");
	}

	return row.id;
}

/** An upload with bytes in the bucket, linked to `sampleId` at `index`. */
async function seedInput(sampleId: number, index: number): Promise<number> {
	const storageKey = mintRootStorageKey("uploads");

	await storage.write(storageKey, body(`input ${index}`));

	const [row] = await db
		.insert(uploads)
		.values({
			createdAt: new Date(),
			name: `input_${index}.fq.gz`,
			nameOnDisk: `${index}-input.fq.gz`,
			ready: true,
			reserved: true,
			size: 8,
			storageKey,
			type: "reads",
			userId,
		})
		.returning({ id: uploads.id });

	if (!row) {
		throw new Error("failed to seed upload");
	}

	await db.insert(sampleUploads).values({
		sample: String(sampleId),
		sample_id: sampleId,
		upload_id: row.id,
		index,
	});

	return row.id;
}

function patch(
	sampleId: number,
	payload: unknown,
	authenticated = true,
): Request {
	return new Request(`https://jobs.virtool.test/samples/${sampleId}`, {
		method: "PATCH",
		headers: {
			"content-type": "application/json",
			...(authenticated ? { authorization: `Basic ${credential}` } : {}),
		},
		body: JSON.stringify(payload),
	});
}

/** A manifest entry for `name`, with its bytes already in the bucket. */
async function written(
	sampleId: number,
	name: string,
	contents: string,
): Promise<SampleReadManifest> {
	const storageKey = mintStorageKey("samples", sampleId);

	await storage.write(storageKey, body(contents));

	return { kind: "sampleRead", name, storageKey };
}

function finalize(sampleId: number, files: unknown[]) {
	return handleFinalizeSample(
		deps,
		patch(sampleId, { quality: QUALITY, files }),
		String(sampleId),
	);
}

describe("handleFinalizeSample", () => {
	it("refuses an unauthenticated caller", async () => {
		const sampleId = await seedSample();

		const response = await handleFinalizeSample(
			deps,
			patch(sampleId, { quality: QUALITY, files: [] }, false),
			String(sampleId),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(sampleReads)).toEqual([]);
	});

	it("records the reads and flips the sample ready", async () => {
		const sampleId = await seedSample({ paired: true });
		await seedInput(sampleId, 0);
		await seedInput(sampleId, 1);

		const first = await written(sampleId, "reads_1.fq.gz", "forward reads");
		const second = await written(sampleId, "reads_2.fq.gz", "rev");

		const response = await finalize(sampleId, [second, first]);

		expect(response.status).toBe(200);

		const returned = await response.json();

		expect(returned.ready).toBe(true);
		expect(returned.quality).toStrictEqual(QUALITY);

		const rows = await db
			.select()
			.from(sampleReads)
			.orderBy(asc(sampleReads.name));

		expect(
			rows.map((row) => ({
				name: row.name,
				nameOnDisk: row.name_on_disk,
				size: row.size,
				storageKey: row.storage_key,
				sample: row.sample,
			})),
		).toStrictEqual([
			{
				name: "reads_1.fq.gz",
				nameOnDisk: "reads_1.fq.gz",
				size: 13,
				storageKey: first.storageKey,
				sample: String(sampleId),
			},
			{
				name: "reads_2.fq.gz",
				nameOnDisk: "reads_2.fq.gz",
				size: 3,
				storageKey: second.storageKey,
				sample: String(sampleId),
			},
		]);
	});

	// The link is by position — `sample_uploads.index` is the order the uploads
	// were given at creation, and the workflow writes them out in that order —
	// so a runner has no field with which to name another sample's upload.
	it("links each read to the upload it came from, by position", async () => {
		const sampleId = await seedSample({ paired: true });
		const firstUpload = await seedInput(sampleId, 0);
		const secondUpload = await seedInput(sampleId, 1);

		await finalize(sampleId, [
			await written(sampleId, "reads_2.fq.gz", "rev"),
			await written(sampleId, "reads_1.fq.gz", "fwd"),
		]);

		const rows = await db
			.select({ name: sampleReads.name, upload: sampleReads.upload })
			.from(sampleReads)
			.orderBy(asc(sampleReads.name));

		expect(rows).toStrictEqual([
			{ name: "reads_1.fq.gz", upload: firstUpload },
			{ name: "reads_2.fq.gz", upload: secondUpload },
		]);
	});

	// Matching Python. A row marked removed but still naming a live object is
	// invisible to the UI and to any orphan sweep, so the bytes would leak
	// permanently — one full duplicate of every sample's input reads.
	it("removes the input uploads and deletes their objects", async () => {
		const sampleId = await seedSample();
		const uploadId = await seedInput(sampleId, 0);

		const [before] = await db
			.select({ storageKey: uploads.storageKey })
			.from(uploads)
			.where(eq(uploads.id, uploadId));

		await finalize(sampleId, [
			await written(sampleId, "reads_1.fq.gz", "forward reads"),
		]);

		const [row] = await db
			.select({ removed: uploads.removed, removedAt: uploads.removedAt })
			.from(uploads)
			.where(eq(uploads.id, uploadId));

		expect(row?.removed).toBe(true);
		expect(row?.removedAt).toBeInstanceOf(Date);

		await expect(storage.size(before?.storageKey as string)).rejects.toThrow();
	});

	it("stores the size it read from storage, not one the caller sent", async () => {
		const sampleId = await seedSample();
		const file = await written(sampleId, "reads_1.fq.gz", "forward reads");

		await finalize(sampleId, [{ ...file, size: 999_999 }]);

		const [row] = await db.select().from(sampleReads);

		expect(row?.size).toBe(13);
	});

	it("answers 400 and writes nothing when a read names no stored object", async () => {
		const sampleId = await seedSample();
		const uploadId = await seedInput(sampleId, 0);

		const response = await finalize(sampleId, [
			{
				kind: "sampleRead",
				name: "reads_1.fq.gz",
				storageKey: mintStorageKey("samples", sampleId),
			},
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(sampleReads)).toEqual([]);

		const [sample] = await db
			.select({ ready: legacySamples.ready, quality: legacySamples.quality })
			.from(legacySamples)
			.where(eq(legacySamples.id, sampleId));

		expect(sample).toStrictEqual({ ready: false, quality: null });

		// The inputs are untouched, so a retried finalize still has them.
		const [upload] = await db
			.select({ removed: uploads.removed })
			.from(uploads)
			.where(eq(uploads.id, uploadId));

		expect(upload?.removed).toBe(false);
	});

	it("refuses a key belonging to another sample", async () => {
		const sampleId = await seedSample();
		const otherId = await seedSample({ job_id: null });

		const response = await finalize(sampleId, [
			await written(otherId, "reads_1.fq.gz", "not yours"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(sampleReads)).toEqual([]);
	});

	// A sample with no reads is not a usable sample, and the parent must not flip
	// ready over nothing.
	it("refuses an empty manifest", async () => {
		const sampleId = await seedSample();
		const uploadId = await seedInput(sampleId, 0);

		const response = await finalize(sampleId, []);

		expect(response.status).toBe(400);
		expect(await db.select().from(sampleReads)).toEqual([]);

		const [sample] = await db
			.select({ ready: legacySamples.ready })
			.from(legacySamples)
			.where(eq(legacySamples.id, sampleId));

		expect(sample?.ready).toBe(false);

		// The inputs survive a refused finalize.
		const [upload] = await db
			.select({ removed: uploads.removed })
			.from(uploads)
			.where(eq(uploads.id, uploadId));

		expect(upload?.removed).toBe(false);
	});

	// A `create_sample` run writes one read or a pair, never three.
	it("refuses a third read", async () => {
		const sampleId = await seedSample();

		const response = await finalize(sampleId, [
			await written(sampleId, "reads_1.fq.gz", "fwd"),
			await written(sampleId, "reads_2.fq.gz", "rev"),
			await written(sampleId, "reads_1.fq.gz", "extra"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(sampleReads)).toEqual([]);
	});

	it("refuses anything but the two reads filenames", async () => {
		const sampleId = await seedSample();

		for (const name of [
			"reads_3.fq.gz",
			"unmapped.fq.gz",
			"../reads_1.fq.gz",
		]) {
			const file = await written(sampleId, "reads_1.fq.gz", "x");

			expect((await finalize(sampleId, [{ ...file, name }])).status).toBe(400);
		}

		expect(await db.select().from(sampleReads)).toEqual([]);
	});

	it("answers 409 on a second finalize", async () => {
		const sampleId = await seedSample();

		expect(
			(
				await finalize(sampleId, [
					await written(sampleId, "reads_1.fq.gz", "forward reads"),
				])
			).status,
		).toBe(200);

		const second = await finalize(sampleId, [
			await written(sampleId, "reads_2.fq.gz", "rev"),
		]);

		expect(second.status).toBe(409);
		expect(await db.select().from(sampleReads)).toHaveLength(1);
	});

	// Every running job holds a valid credential, so without this check any one
	// of them could flip any sample ready and hang reads rows off it.
	it("answers 403 for a sample another job produced", async () => {
		const other = await seedJob(db, userId, { workflow: "create_sample" });
		const sampleId = await seedSample({ job_id: other.id });

		const response = await finalize(sampleId, [
			await written(sampleId, "reads_1.fq.gz", "forward reads"),
		]);

		expect(response.status).toBe(403);
		expect(await db.select().from(sampleReads)).toEqual([]);

		const [sample] = await db
			.select({ ready: legacySamples.ready })
			.from(legacySamples)
			.where(eq(legacySamples.id, sampleId));

		expect(sample?.ready).toBe(false);
	});

	// A sample created before jobs, or by hand, is owned by nobody — which is not
	// the same as being owned by whoever asks.
	it("answers 403 for a sample no job produced", async () => {
		const sampleId = await seedSample({ job_id: null });

		const response = await finalize(sampleId, [
			await written(sampleId, "reads_1.fq.gz", "forward reads"),
		]);

		expect(response.status).toBe(403);
		expect(await db.select().from(sampleReads)).toEqual([]);
	});

	// 403 rather than 409: a sample a job does not own never reports its state.
	it("answers 403, not 409, for a finalized sample another job produced", async () => {
		const other = await seedJob(db, userId, { workflow: "create_sample" });
		const sampleId = await seedSample({ job_id: other.id, ready: true });

		const response = await finalize(sampleId, [
			await written(sampleId, "reads_1.fq.gz", "forward reads"),
		]);

		expect(response.status).toBe(403);
	});

	it("answers 404 for a sample that does not exist", async () => {
		const response = await finalize(999_999, [
			await written(999_999, "reads_1.fq.gz", "forward reads"),
		]);

		expect(response.status).toBe(404);
	});

	it("answers 404 for an id that is not a row id", async () => {
		const response = await handleFinalizeSample(
			deps,
			patch(1, { quality: QUALITY, files: [] }),
			"0",
		);

		expect(response.status).toBe(404);
	});

	it("answers 400 for a malformed body", async () => {
		const sampleId = await seedSample();

		const request = new Request(
			`https://jobs.virtool.test/samples/${sampleId}`,
			{
				method: "PATCH",
				headers: {
					authorization: `Basic ${credential}`,
					"content-type": "application/json",
				},
				body: "{",
			},
		);

		const response = await handleFinalizeSample(
			deps,
			request,
			String(sampleId),
		);

		expect(response.status).toBe(400);
	});

	// `sample_uploads` rows on a migrated sample are keyed by the legacy string
	// rather than the integer id, so the upload lookup has to accept either.
	it("finalizes a sample migrated out of Mongo", async () => {
		const sampleId = await seedSample({ legacy_id: "abc123" });

		const storageKey = mintRootStorageKey("uploads");
		await storage.write(storageKey, body("input"));

		const [upload] = await db
			.insert(uploads)
			.values({
				createdAt: new Date(),
				name: "input.fq.gz",
				ready: true,
				reserved: true,
				size: 5,
				storageKey,
				type: "reads",
				userId,
			})
			.returning({ id: uploads.id });

		await db.insert(sampleUploads).values({
			sample: "abc123",
			sample_id: null,
			upload_id: upload?.id as number,
			index: 0,
		});

		const file = await written(sampleId, "reads_1.fq.gz", "forward reads");

		expect((await finalize(sampleId, [file])).status).toBe(200);

		const [read] = await db.select().from(sampleReads);

		expect(read?.storage_key).toBe(file.storageKey);
		expect(read?.upload).toBe(upload?.id);
	});
});

function get(sampleId: number | string, authenticated = true): Request {
	return new Request(`https://jobs.virtool.test/samples/${sampleId}`, {
		headers: authenticated ? { authorization: `Basic ${credential}` } : {},
	});
}

describe("handleGetSample", () => {
	it("serves the sample and its reads", async () => {
		const sampleId = await seedSample({
			name: "Sample 1",
			library_type: "srna",
			quality: QUALITY,
		});

		await db.insert(sampleReads).values({
			sample: String(sampleId),
			sample_id: sampleId,
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
			size: 1024,
			storage_key: "samples/3/aaaabbbbccccddddeeeeffff00001111",
			uploaded_at: new Date(),
		});

		const response = await handleGetSample(
			deps,
			get(sampleId),
			String(sampleId),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: sampleId,
			libraryType: "srna",
			name: "Sample 1",
			paired: false,
			quality: QUALITY,
			reads: [
				{
					id: expect.any(Number),
					name: "reads_1.fq.gz",
					size: 1024,
					storageKey: "samples/3/aaaabbbbccccddddeeeeffff00001111",
				},
			],
		});
	});

	// Derived from the reads rather than stored, and what a workflow branches on
	// to decide whether it is running one file or two.
	it("reports paired for a sample with two reads files", async () => {
		const sampleId = await seedSample();

		await db.insert(sampleReads).values([
			{
				sample: String(sampleId),
				sample_id: sampleId,
				name: "reads_1.fq.gz",
				name_on_disk: "reads_1.fq.gz",
				size: 1,
				storage_key: "samples/1/a",
				uploaded_at: new Date(),
			},
			{
				sample: String(sampleId),
				sample_id: sampleId,
				name: "reads_2.fq.gz",
				name_on_disk: "reads_2.fq.gz",
				size: 1,
				storage_key: "samples/1/b",
				uploaded_at: new Date(),
			},
		]);

		const response = await handleGetSample(
			deps,
			get(sampleId),
			String(sampleId),
		);
		const sample = (await response.json()) as { paired: boolean };

		expect(sample.paired).toBe(true);
	});

	// A migrated sample's reads sit under whatever prefix they were written with,
	// which no pattern reconstructs. If the handler ever composed a key rather than
	// reading the column, this is the test that fails.
	it("returns a migrated read's recorded key verbatim", async () => {
		const sampleId = await seedSample();
		const legacyKey = "samples/abc123def456/reads_1.fq.gz";

		await db.insert(sampleReads).values({
			sample: String(sampleId),
			sample_id: sampleId,
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
			size: 1,
			storage_key: legacyKey,
			uploaded_at: new Date(),
		});

		const response = await handleGetSample(
			deps,
			get(sampleId),
			String(sampleId),
		);
		const sample = (await response.json()) as {
			reads: { storageKey: string }[];
		};

		expect(sample.reads[0]?.storageKey).toBe(legacyKey);
	});

	it("serves no download URL and no name_on_disk", async () => {
		const sampleId = await seedSample();

		await db.insert(sampleReads).values({
			sample: String(sampleId),
			sample_id: sampleId,
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
			size: 1,
			storage_key: "samples/1/a",
			uploaded_at: new Date(),
		});

		const response = await handleGetSample(
			deps,
			get(sampleId),
			String(sampleId),
		);
		const rendered = await response.text();

		expect(rendered).not.toContain("downloadUrl");
		expect(rendered).not.toContain("nameOnDisk");
	});

	it("reports 404 for a sample that does not exist", async () => {
		const response = await handleGetSample(deps, get(404_040), "404040");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Sample not found" });
	});

	it("reports 404 for an id that is not a positive integer", async () => {
		const response = await handleGetSample(deps, get("latest"), "latest");

		expect(response.status).toBe(404);
	});

	it("refuses an unauthenticated request", async () => {
		const sampleId = await seedSample();

		const response = await handleGetSample(
			deps,
			get(sampleId, false),
			String(sampleId),
		);

		expect(response.status).toBe(401);
	});
});
