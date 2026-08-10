import type { AnalysisFileManifest } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { analyses, analysisFiles } from "@virtool/data/db/schema/analyses";
import { indexes } from "@virtool/data/db/schema/indexes";
import { jobs } from "@virtool/data/db/schema/jobs";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { legacySamples } from "@virtool/data/db/schema/samples";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { MemoryStorage, mintStorageKey } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import {
	type AnalysisHandlerDeps,
	handleFinalizeAnalysis,
	handleGetAnalysis,
} from "./handlers";

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let deps: AnalysisHandlerDeps;
let credential: string;
let jobId: number;
let userId: number;
let referenceId: number;
let indexId: number;

const logger = createLogger({ name: "test", level: "silent" });

const RESULTS = { hits: [{ id: "otu-1", best_score: 12.5 }] };

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(analysisFiles);
	await db.delete(analyses);
	await db.delete(indexes);
	await db.delete(legacyReferences);
	await db.delete(legacySamples);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);

	const job = await seedJob(db, userId, { workflow: "pathoscope" });

	jobId = job.id;
	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	storage = new MemoryStorage();
	deps = { db, storage, logger };

	const [reference] = await db
		.insert(legacyReferences)
		.values({ name: "Reference" })
		.returning({ id: legacyReferences.id });

	referenceId = reference?.id as number;

	const [index] = await db
		.insert(indexes)
		.values({
			created_at: new Date(),
			manifest: {},
			ready: true,
			reference_id: referenceId,
			storage_key: "indexes/1/abc",
			user_id: userId,
			version: 1,
		})
		.returning({ id: indexes.id });

	indexId = index?.id as number;
});

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

async function seedSample(): Promise<number> {
	const [row] = await db
		.insert(legacySamples)
		.values({
			name: `Sample ${Math.random()}`,
			library_type: "normal",
			created_at: new Date(),
			user_id: userId,
		})
		.returning({ id: legacySamples.id });

	return row?.id as number;
}

async function seedAnalysis(
	overrides: Partial<typeof analyses.$inferInsert> = {},
): Promise<number> {
	const now = new Date();
	const sampleId = await seedSample();

	const [row] = await db
		.insert(analyses)
		.values({
			created_at: now,
			updated_at: now,
			workflow: "pathoscope",
			ready: false,
			results: null,
			sample: String(sampleId),
			sample_id: sampleId,
			reference_id: referenceId,
			index_id: indexId,
			user_id: userId,
			job_id: jobId,
			...overrides,
		})
		.returning({ id: analyses.id });

	return row?.id as number;
}

function patch(
	analysisId: number,
	payload: unknown,
	authenticated = true,
): Request {
	return new Request(`https://jobs.virtool.test/analyses/${analysisId}`, {
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
	analysisId: number,
	name: string,
	contents: string,
	format: AnalysisFileManifest["format"] = "tsv",
): Promise<AnalysisFileManifest> {
	const storageKey = mintStorageKey("analyses", analysisId);

	await storage.write(storageKey, body(contents));

	return {
		kind: "analysisFile",
		name,
		storageKey,
		format,
		description: null,
	};
}

function finalize(analysisId: number, files: unknown[]) {
	return handleFinalizeAnalysis(
		deps,
		patch(analysisId, { results: RESULTS, files }),
		String(analysisId),
	);
}

describe("handleFinalizeAnalysis", () => {
	it("refuses an unauthenticated caller", async () => {
		const analysisId = await seedAnalysis();

		const response = await handleFinalizeAnalysis(
			deps,
			patch(analysisId, { results: RESULTS, files: [] }, false),
			String(analysisId),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(analysisFiles)).toEqual([]);
	});

	it("records the files, the results and flips the analysis ready", async () => {
		const analysisId = await seedAnalysis();

		const report = await written(analysisId, "report.tsv", "a\tb\tc");

		const response = await finalize(analysisId, [
			{ ...report, description: "The formatted report." },
		]);

		expect(response.status).toBe(200);
		expect((await response.json()).ready).toBe(true);

		const [row] = await db
			.select()
			.from(analysisFiles)
			.where(eq(analysisFiles.analysis_id, analysisId));

		expect(row?.name).toBe("report.tsv");
		expect(row?.format).toBe("tsv");
		expect(row?.description).toBe("The formatted report.");
		expect(row?.size).toBe(5);
		expect(row?.storage_key).toBe(report.storageKey);

		const [analysis] = await db
			.select({ ready: analyses.ready, results: analyses.results })
			.from(analyses)
			.where(eq(analyses.id, analysisId));

		expect(analysis?.ready).toBe(true);
		expect(analysis?.results).toStrictEqual(RESULTS);
	});

	// `analysis_files.name_on_disk` is unique across the whole table, so it cannot
	// be the workflow's filename. A uuid prefix keeps two analyses free to retain
	// files of the same name.
	it("mints a unique name_on_disk rather than taking one from the wire", async () => {
		const first = await seedAnalysis();
		const second = await seedAnalysis();

		await finalize(first, [await written(first, "report.tsv", "a")]);
		await finalize(second, [await written(second, "report.tsv", "b")]);

		const rows = await db
			.select({ name: analysisFiles.name, onDisk: analysisFiles.name_on_disk })
			.from(analysisFiles);

		expect(rows).toHaveLength(2);
		expect(new Set(rows.map((row) => row.onDisk)).size).toBe(2);

		for (const row of rows) {
			expect(row.onDisk).toMatch(/^[0-9a-f-]{36}-report\.tsv$/);
		}
	});

	// Unlike samples and subtractions, an empty manifest is legitimate here:
	// pathoscope's entire output is `results` and it retains no files.
	it("accepts an empty manifest and still flips the analysis ready", async () => {
		const analysisId = await seedAnalysis();

		const response = await finalize(analysisId, []);

		expect(response.status).toBe(200);
		expect(await db.select().from(analysisFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: analyses.ready })
			.from(analyses)
			.where(eq(analyses.id, analysisId));

		expect(row?.ready).toBe(true);
	});

	it("bumps updated_at", async () => {
		const analysisId = await seedAnalysis({
			updated_at: new Date("2020-01-01T00:00:00.000Z"),
		});

		await finalize(analysisId, []);

		const [row] = await db
			.select({ updatedAt: analyses.updated_at })
			.from(analyses)
			.where(eq(analyses.id, analysisId));

		expect(row?.updatedAt.getTime()).toBeGreaterThan(
			new Date("2020-01-01T00:00:00.000Z").getTime(),
		);
	});

	it("stores the size it read from storage, not one the caller sent", async () => {
		const analysisId = await seedAnalysis();
		const file = await written(analysisId, "report.tsv", "a\tb\tc");

		await finalize(analysisId, [{ ...file, size: 999_999 }]);

		const [row] = await db.select().from(analysisFiles);

		expect(row?.size).toBe(5);
	});

	it("answers 400 and writes nothing when a file names no stored object", async () => {
		const analysisId = await seedAnalysis();

		const response = await finalize(analysisId, [
			await written(analysisId, "report.tsv", "a\tb\tc"),
			{
				kind: "analysisFile",
				name: "hits.json",
				storageKey: mintStorageKey("analyses", analysisId),
				format: "json",
				description: null,
			},
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(analysisFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: analyses.ready, results: analyses.results })
			.from(analyses)
			.where(eq(analyses.id, analysisId));

		expect(row).toStrictEqual({ ready: false, results: null });
	});

	it("refuses a key belonging to another analysis", async () => {
		const analysisId = await seedAnalysis();
		const otherId = await seedAnalysis();

		const response = await finalize(analysisId, [
			await written(otherId, "report.tsv", "not yours"),
		]);

		expect(response.status).toBe(400);
		expect(await db.select().from(analysisFiles)).toEqual([]);
	});

	// The names here are the workflow's to choose, so there is no whitelist — but
	// a separator or a traversal segment is still refused.
	it("refuses a filename that is not a plain name", async () => {
		const analysisId = await seedAnalysis();

		for (const name of ["../escape", "a/b.tsv", ".."]) {
			const file = await written(analysisId, "report.tsv", "x");

			expect((await finalize(analysisId, [{ ...file, name }])).status).toBe(
				400,
			);
		}

		expect(await db.select().from(analysisFiles)).toEqual([]);
	});

	it("answers 409 on a second finalize", async () => {
		const analysisId = await seedAnalysis();

		expect(
			(
				await finalize(analysisId, [
					await written(analysisId, "report.tsv", "a"),
				])
			).status,
		).toBe(200);

		const second = await finalize(analysisId, [
			await written(analysisId, "hits.json", "{}", "json"),
		]);

		expect(second.status).toBe(409);
		expect(await db.select().from(analysisFiles)).toHaveLength(1);
	});

	// Every running job holds a valid credential, so without this check any one
	// of them could write results into any analysis and flip it ready.
	it("answers 403 for an analysis started for another job", async () => {
		const other = await seedJob(db, userId, { workflow: "pathoscope" });
		const analysisId = await seedAnalysis({ job_id: other.id });

		const response = await finalize(analysisId, [
			await written(analysisId, "report.tsv", "a\tb\tc"),
		]);

		expect(response.status).toBe(403);
		expect(await db.select().from(analysisFiles)).toEqual([]);

		const [row] = await db
			.select({ ready: analyses.ready, results: analyses.results })
			.from(analyses)
			.where(eq(analyses.id, analysisId));

		expect(row).toStrictEqual({ ready: false, results: null });
	});

	// An analysis with no job is owned by nobody — which is not the same as being
	// owned by whoever asks.
	it("answers 403 for an analysis no job was started for", async () => {
		const analysisId = await seedAnalysis({ job_id: null });

		const response = await finalize(analysisId, []);

		expect(response.status).toBe(403);
	});

	// 403 rather than 409: an analysis a job does not own never reports its
	// state.
	it("answers 403, not 409, for a finalized analysis started for another job", async () => {
		const other = await seedJob(db, userId, { workflow: "pathoscope" });

		const analysisId = await seedAnalysis({
			job_id: other.id,
			ready: true,
			results: RESULTS,
		});

		const response = await finalize(analysisId, []);

		expect(response.status).toBe(403);
	});

	it("answers 404 for an analysis that does not exist", async () => {
		expect((await finalize(999_999, [])).status).toBe(404);
	});

	it("answers 404 for an id that is not a row id", async () => {
		const response = await handleFinalizeAnalysis(
			deps,
			patch(1, { results: RESULTS, files: [] }),
			"1.5",
		);

		expect(response.status).toBe(404);
	});

	it("answers 400 for a malformed body", async () => {
		const analysisId = await seedAnalysis();

		const request = new Request(
			`https://jobs.virtool.test/analyses/${analysisId}`,
			{
				method: "PATCH",
				headers: {
					authorization: `Basic ${credential}`,
					"content-type": "application/json",
				},
				body: "{",
			},
		);

		const response = await handleFinalizeAnalysis(
			deps,
			request,
			String(analysisId),
		);

		expect(response.status).toBe(400);
	});
});

function get(analysisId: number | string, authenticated = true): Request {
	return new Request(`https://jobs.virtool.test/analyses/${analysisId}`, {
		headers: authenticated ? { authorization: `Basic ${credential}` } : {},
	});
}

describe("handleGetAnalysis", () => {
	it("serves the records a workflow runs against", async () => {
		const analysisId = await seedAnalysis();

		const response = await handleGetAnalysis(
			deps,
			get(analysisId),
			String(analysisId),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: analysisId,
			index: { id: indexId, version: 1 },
			ready: false,
			reference: { id: referenceId, name: "Reference" },
			sample: { id: expect.any(Number), name: expect.any(String) },
			subtractions: [],
			workflow: "pathoscope",
		});
	});

	// Python's runtime falls back to reading `sample.id` when a job's args carry
	// no `sample_id`, so flattening this to a bare id breaks every analysis whose
	// job was created without one.
	it("carries the sample as an object, not a bare id", async () => {
		const analysisId = await seedAnalysis();

		const response = await handleGetAnalysis(
			deps,
			get(analysisId),
			String(analysisId),
		);
		const analysis = (await response.json()) as { sample: unknown };

		expect(analysis.sample).toEqual(
			expect.objectContaining({ id: expect.any(Number) }),
		);
	});

	// The results blob is the expensive half of an analysis: reading it runs the
	// history-patching format step. A workflow needs none of it, and a read that
	// dragged it in would make every analysis read pay for that machinery.
	it("does not serve results, even for a finished analysis", async () => {
		const analysisId = await seedAnalysis({ ready: true, results: RESULTS });

		const response = await handleGetAnalysis(
			deps,
			get(analysisId),
			String(analysisId),
		);
		const rendered = await response.text();

		expect(response.status).toBe(200);
		expect(rendered).not.toContain("results");
		expect(rendered).not.toContain("best_score");
	});

	it("reports 404 for an analysis that does not exist", async () => {
		const response = await handleGetAnalysis(deps, get(404_040), "404040");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Analysis not found" });
	});

	// A non-numeric segment names no row, and must not reach the database as one.
	it("reports 404 for an id that is not a positive integer", async () => {
		const response = await handleGetAnalysis(deps, get("counts"), "counts");

		expect(response.status).toBe(404);
	});

	it("refuses an unauthenticated request", async () => {
		const analysisId = await seedAnalysis();

		const response = await handleGetAnalysis(
			deps,
			get(analysisId, false),
			String(analysisId),
		);

		expect(response.status).toBe(401);
	});
});
