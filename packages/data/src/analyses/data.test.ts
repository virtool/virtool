import { MemoryStorage, type StorageBackend } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	analyses,
	analysisFiles,
	analysisSubtractions,
	nuvsBlast,
} from "../db/schema/analyses";
import { groups, userGroups } from "../db/schema/groups";
import { indexes } from "../db/schema/indexes";
import { jobs } from "../db/schema/jobs";
import { legacyReferences } from "../db/schema/references";
import { legacySamples } from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { addToGroup, seedGroup } from "../groups/test/fixtures";
import { resolveSampleActor, type SampleActor } from "../samples/data";
import { testLogger } from "../test/logger";
import {
	AnalysisIntegrityError,
	AnalysisNoReadyIndexError,
	AnalysisNotFoundError,
	AnalysisNotNuvsError,
	AnalysisReferenceArchivedError,
	AnalysisRelationNotFoundError,
	AnalysisRunningError,
	AnalysisSequenceNotFoundError,
	blastNuvs,
	createAnalysis,
	deleteAnalysis,
	findAnalyses,
	findNuvsSequenceByIndex,
	getAnalysis,
	getAnalysisResults,
} from "./data";

let database: TestDatabase;
let db: Db;
let ownerId: number;
let referenceId: number;
let indexId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(nuvsBlast);
	await db.delete(analysisFiles);
	await db.delete(analysisSubtractions);
	await db.delete(analyses);
	await db.delete(indexes);
	await db.delete(legacyReferences);
	await db.delete(legacySamples);
	await db.delete(subtractions);
	await db.delete(jobs);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);

	ownerId = await seedUser(db, { handle: "owner" });
	referenceId = await seedReference();
	indexId = await seedIndex({ referenceId, version: 1, ready: true });
});

async function seedReference(
	overrides: Partial<typeof legacyReferences.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({ name: "Reference", ...overrides })
			.returning({ id: legacyReferences.id }),
	).id;
}

async function seedIndex(values: {
	referenceId: number;
	version: number;
	ready: boolean;
}): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(indexes)
			.values({
				created_at: new Date(),
				manifest: {},
				ready: values.ready,
				reference_id: values.referenceId,
				storage_key: `index-${values.referenceId}-${values.version}`,
				user_id: 1,
				version: values.version,
			})
			.returning({ id: indexes.id }),
	).id;
}

async function seedSample(
	overrides: Partial<typeof legacySamples.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({
				name: `Sample ${Math.random()}`,
				library_type: "normal",
				created_at: new Date(),
				user_id: ownerId,
				...overrides,
			})
			.returning({ id: legacySamples.id }),
	).id;
}

async function seedSubtraction(
	name: string,
	overrides: Partial<typeof subtractions.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(subtractions)
			.values({ name, ...overrides })
			.returning({ id: subtractions.id }),
	).id;
}

async function seedJob(
	overrides: Partial<typeof jobs.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(jobs)
			.values({
				acquired: false,
				created_at: new Date(),
				state: "pending",
				user_id: ownerId,
				workflow: "nuvs",
				...overrides,
			})
			.returning({ id: jobs.id }),
	).id;
}

async function seedAnalysis(
	overrides: Partial<typeof analyses.$inferInsert> = {},
): Promise<number> {
	const now = new Date();

	return takeFirstOrThrow(
		await db
			.insert(analyses)
			.values({
				created_at: now,
				updated_at: now,
				workflow: "nuvs",
				ready: true,
				results: null,
				// The legacy storage slug, NOT NULL upstream.
				sample: String(overrides.sample_id ?? 0),
				sample_id: overrides.sample_id ?? null,
				reference_id: referenceId,
				index_id: indexId,
				user_id: ownerId,
				...overrides,
			})
			.returning({ id: analyses.id }),
	).id;
}

/** An analysis on a sample of its own, for tests that do not care which. */
async function seedAnalysisOnNewSample(
	overrides: Partial<typeof analyses.$inferInsert> = {},
): Promise<number> {
	return seedAnalysis({ sample_id: await seedSample(), ...overrides });
}

async function* oneChunk(): AsyncIterable<Uint8Array> {
	yield new Uint8Array([1, 2, 3]);
}

async function storedKeys(storage: StorageBackend): Promise<Set<string>> {
	const keys = new Set<string>();

	for await (const object of storage.list("")) {
		keys.add(object.key);
	}

	return keys;
}

const adminActor: SampleActor = { userId: 999, groupIds: [], isAdmin: true };

const page = { page: 1, perPage: 25 };

describe("findAnalyses", () => {
	it("scopes a non-admin to analyses on samples they may read", async () => {
		const groupId = await seedGroup(db, { name: "techs" });
		const other = await seedUser(db, { handle: "other" });
		await addToGroup(db, other, groupId);

		const own = await seedAnalysis({
			sample_id: await seedSample({ user_id: other }),
		});
		const world = await seedAnalysis({
			sample_id: await seedSample({ all_read: true }),
		});
		const groupReadable = await seedAnalysis({
			sample_id: await seedSample({ group_id: groupId, group_read: true }),
		});
		await seedAnalysis({ sample_id: await seedSample() });

		const actor = await resolveSampleActor(db, other);
		const result = await findAnalyses(db, page, actor);

		expect(new Set(result.items.map((item) => item.id))).toEqual(
			new Set([own, world, groupReadable]),
		);
		expect(result.foundCount).toBe(3);
	});

	it("returns every analysis for an administrator", async () => {
		await seedAnalysisOnNewSample();
		await seedAnalysisOnNewSample();

		const result = await findAnalyses(db, page, adminActor);

		expect(result.items).toHaveLength(2);
	});

	it("restricts the page to one sample when a sampleId is given", async () => {
		const sampleId = await seedSample();
		const wanted = await seedAnalysis({ sample_id: sampleId });
		await seedAnalysisOnNewSample();

		const result = await findAnalyses(db, { ...page, sampleId }, adminActor);

		expect(result.items.map((item) => item.id)).toEqual([wanted]);
		expect(result.foundCount).toBe(1);
	});

	it("names the parent sample of each analysis", async () => {
		const sampleId = await seedSample({ name: "Parent sample" });
		await seedAnalysis({ sample_id: sampleId });

		const result = await findAnalyses(db, page, adminActor);

		expect(result.items.map((item) => item.sample)).toEqual([
			{ id: sampleId, name: "Parent sample" },
		]);
	});

	it("restricts the page to one user when a userId is given", async () => {
		const other = await seedUser(db, { handle: "other" });

		const wanted = await seedAnalysisOnNewSample({ user_id: other });
		await seedAnalysisOnNewSample();

		const result = await findAnalyses(
			db,
			{ ...page, userId: other },
			adminActor,
		);

		expect(result.items.map((item) => item.id)).toEqual([wanted]);
		expect(result.foundCount).toBe(1);
	});

	it("intersects a userId with the caller's readable samples", async () => {
		const other = await seedUser(db, { handle: "other" });

		await seedAnalysis({
			sample_id: await seedSample({ all_read: false }),
			user_id: other,
		});
		const readable = await seedAnalysis({
			sample_id: await seedSample({ all_read: true }),
			user_id: other,
		});

		const actor = await resolveSampleActor(db, other);
		const result = await findAnalyses(db, { ...page, userId: other }, actor);

		expect(result.items.map((item) => item.id)).toEqual([readable]);
		expect(result.foundCount).toBe(1);
	});

	it("orders by created_at descending, then id descending", async () => {
		const sampleId = await seedSample();
		const older = new Date("2024-01-01T00:00:00Z");
		const newer = new Date("2024-02-01T00:00:00Z");

		const first = await seedAnalysis({
			sample_id: sampleId,
			created_at: older,
		});
		const second = await seedAnalysis({
			sample_id: sampleId,
			created_at: newer,
		});
		const third = await seedAnalysis({
			sample_id: sampleId,
			created_at: newer,
		});

		const result = await findAnalyses(db, page, adminActor);

		expect(result.items.map((item) => item.id)).toEqual([third, second, first]);
	});

	it("pages the results and reports the counts", async () => {
		const sampleId = await seedSample();
		const created = new Date("2024-01-01T00:00:00Z");

		const ids = [
			await seedAnalysis({ sample_id: sampleId, created_at: created }),
			await seedAnalysis({ sample_id: sampleId, created_at: created }),
			await seedAnalysis({ sample_id: sampleId, created_at: created }),
		].sort((a, b) => b - a);

		const first = await findAnalyses(db, { page: 1, perPage: 2 }, adminActor);

		expect(first.items.map((item) => item.id)).toEqual(ids.slice(0, 2));
		expect(first.foundCount).toBe(3);
		// Python reports the scoped count for both.
		expect(first.totalCount).toBe(3);
		expect(first.pageCount).toBe(2);
		expect(first.perPage).toBe(2);

		const second = await findAnalyses(db, { page: 2, perPage: 2 }, adminActor);

		expect(second.items.map((item) => item.id)).toEqual(ids.slice(2));
		expect(second.page).toBe(2);
	});

	it("reports a page count of zero when nothing matches", async () => {
		const result = await findAnalyses(db, page, adminActor);

		expect(result.items).toEqual([]);
		expect(result.foundCount).toBe(0);
		expect(result.pageCount).toBe(0);
	});

	it("attaches subtractions in name order and the workflow job", async () => {
		const jobId = await seedJob({ state: "running", workflow: "nuvs" });
		const analysisId = await seedAnalysisOnNewSample({ job_id: jobId });

		const zebra = await seedSubtraction("Zebra");
		const arabidopsis = await seedSubtraction("Arabidopsis");

		await db.insert(analysisSubtractions).values([
			{ analysis_id: analysisId, subtraction_id: zebra },
			{ analysis_id: analysisId, subtraction_id: arabidopsis },
		]);

		const result = await findAnalyses(db, page, adminActor);
		const [item] = result.items;

		expect(item?.subtractions).toEqual([
			{ id: arabidopsis, name: "Arabidopsis" },
			{ id: zebra, name: "Zebra" },
		]);
		expect(item?.job).toEqual({
			createdAt: expect.any(Date),
			id: jobId,
			progress: 0,
			state: "running",
			user: { id: ownerId, handle: "owner" },
			workflow: "nuvs",
		});
	});

	it("leaves the job null when the analysis has none", async () => {
		await seedAnalysisOnNewSample();

		const result = await findAnalyses(db, page, adminActor);

		expect(result.items[0]?.job).toBeNull();
		expect(result.items[0]?.subtractions).toEqual([]);
	});

	it("raises rather than dropping an analysis whose index does not resolve", async () => {
		await seedAnalysisOnNewSample({ index_id: 987654 });

		await expect(findAnalyses(db, page, adminActor)).rejects.toBeInstanceOf(
			AnalysisIntegrityError,
		);
	});
});

describe("getAnalysis", () => {
	it("returns the full shape, including files and subtractions", async () => {
		const sampleId = await seedSample({ name: "Parent sample" });
		const jobId = await seedJob();
		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			job_id: jobId,
			workflow: "pathoscope",
			ready: false,
		});

		const subtractionId = await seedSubtraction("Arabidopsis");
		await db
			.insert(analysisSubtractions)
			.values({ analysis_id: analysisId, subtraction_id: subtractionId });

		const uploadedAt = new Date("2024-03-01T00:00:00Z");
		await db.insert(analysisFiles).values({
			analysis_id: analysisId,
			description: "The reads that mapped",
			format: "tsv",
			name: "report.tsv",
			name_on_disk: "1-report.tsv",
			size: 1024,
			uploaded_at: uploadedAt,
		});

		const analysis = await getAnalysis(db, analysisId);

		expect(analysis.id).toBe(analysisId);
		expect(analysis.workflow).toBe("pathoscope");
		expect(analysis.ready).toBe(false);
		expect(analysis.sample).toEqual({ id: sampleId, name: "Parent sample" });
		expect(analysis.reference).toEqual({ id: referenceId, name: "Reference" });
		expect(analysis.index).toEqual({ id: indexId, version: 1 });
		expect(analysis.user).toEqual({ id: ownerId, handle: "owner" });
		expect(analysis.job?.id).toBe(jobId);
		expect(analysis.subtractions).toEqual([
			{ id: subtractionId, name: "Arabidopsis" },
		]);
		expect(analysis.files).toEqual([
			{
				analysis: analysisId,
				description: "The reads that mapped",
				format: "tsv",
				id: expect.any(Number),
				name: "report.tsv",
				nameOnDisk: "1-report.tsv",
				size: 1024,
				uploadedAt,
			},
		]);
		expect(analysis.createdAt).toBeInstanceOf(Date);
		expect(analysis.updatedAt).toBeInstanceOf(Date);
	});

	it("throws when the analysis does not exist", async () => {
		await expect(getAnalysis(db, 123456)).rejects.toBeInstanceOf(
			AnalysisNotFoundError,
		);
	});

	it("does not carry the results", async () => {
		const analysisId = await seedAnalysisOnNewSample({
			workflow: "pathoscope",
			ready: true,
			results: { hits: [] },
		});

		// Not merely null — absent. Reading the TOASTed column is the expense this
		// split exists to keep off the metadata request.
		expect("results" in (await getAnalysis(db, analysisId))).toBe(false);
	});
});

describe("getAnalysisResults", () => {
	it("throws when the analysis does not exist", async () => {
		await expect(getAnalysisResults(db, 123456)).rejects.toBeInstanceOf(
			AnalysisNotFoundError,
		);
	});

	it("returns null for an unfinished analysis", async () => {
		const analysisId = await seedAnalysisOnNewSample({ ready: false });

		expect(await getAnalysisResults(db, analysisId)).toBeNull();
	});

	it("leaves an unfinished analysis's results unformatted", async () => {
		// A pathoscope hit with no `otu` key, which formatting would refuse. It
		// comes back verbatim, proving the formatter never ran.
		const results = { hits: [{ id: "seq" }] };

		const analysisId = await seedAnalysisOnNewSample({
			workflow: "pathoscope",
			ready: false,
			results,
		});

		expect(await getAnalysisResults(db, analysisId)).toEqual(results);
	});

	it("merges NuVs BLAST records onto the hit with the matching index", async () => {
		const analysisId = await seedAnalysisOnNewSample({
			workflow: "nuvs",
			ready: true,
			results: {
				hits: [
					{ index: 0, sequence: "ATGC", orfs: [] },
					{ index: 1, sequence: "GGTT", orfs: [] },
				],
			},
		});

		const timestamp = new Date("2024-04-01T00:00:00Z");

		await db.insert(nuvsBlast).values({
			analysis_id: analysisId,
			created_at: timestamp,
			last_checked_at: timestamp,
			ready: true,
			rid: "RID-1",
			result: { hits: [] },
			sequence_index: 0,
			updated_at: timestamp,
		});

		const results = (await getAnalysisResults(db, analysisId)) as unknown as {
			hits: { index: number; blast: Record<string, unknown> | null }[];
		};

		expect(results.hits[0]?.blast).toEqual({
			createdAt: timestamp,
			error: null,
			id: expect.any(Number),
			interval: 3,
			lastCheckedAt: timestamp,
			ready: true,
			result: { hits: [] },
			rid: "RID-1",
			sequenceIndex: 0,
			updatedAt: timestamp,
		});
		expect(results.hits[1]?.blast).toBeNull();
	});
});

describe("createAnalysis", () => {
	it("inserts the analysis, its subtractions, and a job in one transaction", async () => {
		const sampleId = await seedSample({ name: "Parent sample" });
		const first = await seedSubtraction("Arabidopsis");
		const second = await seedSubtraction("Zebra");

		const analysis = await createAnalysis(db, {
			sampleId,
			referenceId,
			subtractionIds: [first, second],
			workflow: "nuvs",
			userId: ownerId,
		});

		expect(analysis.workflow).toBe("nuvs");
		expect(analysis.ready).toBe(false);
		expect(analysis.sample).toEqual({ id: sampleId, name: "Parent sample" });
		expect(analysis.index).toEqual({ id: indexId, version: 1 });
		expect(analysis.subtractions.map((subtraction) => subtraction.id)).toEqual([
			first,
			second,
		]);

		const [row] = await db
			.select()
			.from(analyses)
			.where(eq(analyses.id, analysis.id));

		expect(row?.sample).toBe(String(sampleId));
		expect(row?.reference_id).toBe(referenceId);
		expect(row?.index_id).toBe(indexId);
		expect(row?.user_id).toBe(ownerId);

		const links = await db
			.select()
			.from(analysisSubtractions)
			.where(eq(analysisSubtractions.analysis_id, analysis.id));
		expect(links).toHaveLength(2);

		// The job is created in the analysis's transaction and linked by `job_id`,
		// so a runner cannot claim it before the analysis row exists.
		expect(row?.job_id).toBe(analysis.job?.id);

		const [job] = await db
			.select()
			.from(jobs)
			.where(eq(jobs.id, row?.job_id ?? 0));
		expect(job?.workflow).toBe("nuvs");
		expect(job?.state).toBe("pending");
		expect(job?.user_id).toBe(ownerId);
	});

	it("uses the sample's legacy storage id when it has one", async () => {
		const sampleId = await seedSample({ legacy_id: "abc123" });

		const analysis = await createAnalysis(db, {
			sampleId,
			referenceId,
			subtractionIds: [],
			workflow: "nuvs",
			userId: ownerId,
		});

		const [row] = await db
			.select({ sample: analyses.sample })
			.from(analyses)
			.where(eq(analyses.id, analysis.id));

		expect(row?.sample).toBe("abc123");
	});

	it("picks the reference's highest-versioned ready index", async () => {
		const sampleId = await seedSample();
		const current = await seedIndex({ referenceId, version: 3, ready: true });
		await seedIndex({ referenceId, version: 9, ready: false });

		const analysis = await createAnalysis(db, {
			sampleId,
			referenceId,
			subtractionIds: [],
			workflow: "nuvs",
			userId: ownerId,
		});

		expect(analysis.index).toEqual({ id: current, version: 3 });
	});

	it("refuses a sample that does not exist", async () => {
		await expect(
			createAnalysis(db, {
				sampleId: 123456,
				referenceId,
				subtractionIds: [],
				workflow: "nuvs",
				userId: ownerId,
			}),
		).rejects.toBeInstanceOf(AnalysisRelationNotFoundError);

		expect(await db.select().from(analyses)).toHaveLength(0);
		expect(await db.select().from(jobs)).toHaveLength(0);
	});

	it("refuses a reference that does not exist", async () => {
		const sampleId = await seedSample();

		await expect(
			createAnalysis(db, {
				sampleId,
				referenceId: 123456,
				subtractionIds: [],
				workflow: "nuvs",
				userId: ownerId,
			}),
		).rejects.toBeInstanceOf(AnalysisRelationNotFoundError);
	});

	it("refuses an archived reference", async () => {
		const sampleId = await seedSample();
		const archived = await seedReference({ name: "Old", archived: true });
		await seedIndex({ referenceId: archived, version: 1, ready: true });

		await expect(
			createAnalysis(db, {
				sampleId,
				referenceId: archived,
				subtractionIds: [],
				workflow: "nuvs",
				userId: ownerId,
			}),
		).rejects.toBeInstanceOf(AnalysisReferenceArchivedError);
	});

	it("refuses a reference with no ready index", async () => {
		const sampleId = await seedSample();
		const unbuilt = await seedReference({ name: "Unbuilt" });
		await seedIndex({ referenceId: unbuilt, version: 1, ready: false });

		await expect(
			createAnalysis(db, {
				sampleId,
				referenceId: unbuilt,
				subtractionIds: [],
				workflow: "nuvs",
				userId: ownerId,
			}),
		).rejects.toBeInstanceOf(AnalysisNoReadyIndexError);
	});

	it("refuses subtractions that do not exist or were deleted", async () => {
		const sampleId = await seedSample();
		const deleted = await seedSubtraction("Gone", { deleted: true });

		const create = createAnalysis(db, {
			sampleId,
			referenceId,
			subtractionIds: [deleted, 123456],
			workflow: "nuvs",
			userId: ownerId,
		});

		await expect(create).rejects.toBeInstanceOf(AnalysisRelationNotFoundError);
		await expect(create).rejects.toThrow(
			`Subtractions do not exist: ${deleted}, 123456`,
		);

		expect(await db.select().from(analyses)).toHaveLength(0);
	});
});

describe("deleteAnalysis", () => {
	it("removes the row and returns the analysis as it was", async () => {
		const storage = new MemoryStorage();
		const analysisId = await seedAnalysisOnNewSample();

		const deleted = await deleteAnalysis(db, storage, testLogger, analysisId);

		expect(deleted.id).toBe(analysisId);
		expect(
			await db.select().from(analyses).where(eq(analyses.id, analysisId)),
		).toHaveLength(0);
	});

	it("throws when the analysis does not exist", async () => {
		await expect(
			deleteAnalysis(db, new MemoryStorage(), testLogger, 123456),
		).rejects.toBeInstanceOf(AnalysisNotFoundError);
	});

	it.each(["pending", "running"])(
		"refuses an analysis whose job is %s",
		async (state) => {
			const analysisId = await seedAnalysisOnNewSample({
				ready: false,
				job_id: await seedJob({ state }),
			});

			await expect(
				deleteAnalysis(db, new MemoryStorage(), testLogger, analysisId),
			).rejects.toBeInstanceOf(AnalysisRunningError);

			expect(
				await db.select().from(analyses).where(eq(analyses.id, analysisId)),
			).toHaveLength(1);
		},
	);

	// A workflow pod that is OOM-killed or evicted never finalizes its analysis,
	// so the row stays unready forever. Deletion has to follow the job, not
	// `ready`, or nothing can ever clean these up.
	it.each(["cancelled", "failed", "succeeded"])(
		"deletes an unready analysis whose job is %s",
		async (state) => {
			const analysisId = await seedAnalysisOnNewSample({
				ready: false,
				job_id: await seedJob({ state }),
			});

			await deleteAnalysis(db, new MemoryStorage(), testLogger, analysisId);

			expect(
				await db.select().from(analyses).where(eq(analyses.id, analysisId)),
			).toHaveLength(0);
		},
	);

	it("deletes an unready analysis with no job row", async () => {
		const analysisId = await seedAnalysisOnNewSample({
			ready: false,
			job_id: null,
		});

		await deleteAnalysis(db, new MemoryStorage(), testLogger, analysisId);

		expect(
			await db.select().from(analyses).where(eq(analyses.id, analysisId)),
		).toHaveLength(0);
	});

	it("deletes the objects its file rows name", async () => {
		const storage = new MemoryStorage();
		const sampleId = await seedSample();

		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			sample: String(sampleId),
			legacy_id: null,
		});

		await db.insert(analysisFiles).values([
			{ analysis_id: analysisId, name: "a.fa", storage_key: "analyses/a" },
			{ analysis_id: analysisId, name: "b.fa", storage_key: "analyses/b" },
		]);

		for (const key of ["analyses/a", "analyses/b", "analyses/other"]) {
			await storage.write(key, oneChunk());
		}

		await deleteAnalysis(db, storage, testLogger, analysisId);

		expect(await storedKeys(storage)).toEqual(new Set(["analyses/other"]));
	});

	// A migrated analysis's result blobs were written before keys were recorded,
	// so no row names them and nothing here can reach them. They are the orphan
	// sweep's problem, not this delete's.
	it("leaves a migrated analysis's unrecorded objects", async () => {
		const storage = new MemoryStorage();
		const sampleId = await seedSample({ legacy_id: "smpl" });

		const keys = [
			"samples/smpl/analysis/abc/results.json",
			"samples/smpl/analysis/abc/nuvs.fa",
		];

		for (const key of keys) {
			await storage.write(key, oneChunk());
		}

		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			sample: "smpl",
			legacy_id: "abc",
		});

		await deleteAnalysis(db, storage, testLogger, analysisId);

		expect(await storedKeys(storage)).toEqual(new Set(keys));
	});
});

describe("blastNuvs", () => {
	const nuvsResults = {
		hits: [
			{ index: 0, sequence: "ATGCATGC", orfs: [] },
			{ index: 3, sequence: "GGTTAACC", orfs: [] },
		],
	};

	async function seedNuvs(
		overrides: Partial<typeof analyses.$inferInsert> = {},
	): Promise<number> {
		return seedAnalysisOnNewSample({
			workflow: "nuvs",
			ready: true,
			results: nuvsResults,
			...overrides,
		});
	}

	it("creates a pending BLAST row and bumps the analysis's updated_at", async () => {
		const stale = new Date("2024-01-01T00:00:00Z");
		const analysisId = await seedNuvs({ updated_at: stale });

		const blast = await blastNuvs(db, analysisId, 3);

		expect(blast).toEqual({
			createdAt: expect.any(Date),
			error: null,
			id: expect.any(Number),
			interval: 3,
			lastCheckedAt: expect.any(Date),
			ready: false,
			result: null,
			rid: null,
			sequenceIndex: 3,
			updatedAt: expect.any(Date),
		});

		const rows = await db
			.select()
			.from(nuvsBlast)
			.where(eq(nuvsBlast.analysis_id, analysisId));
		expect(rows).toHaveLength(1);

		const [row] = await db
			.select({ updated_at: analyses.updated_at })
			.from(analyses)
			.where(eq(analyses.id, analysisId));
		expect(row?.updated_at.getTime()).toBeGreaterThan(stale.getTime());
	});

	it("replaces an existing BLAST for the same sequence", async () => {
		const analysisId = await seedNuvs();

		const first = await blastNuvs(db, analysisId, 0);
		const second = await blastNuvs(db, analysisId, 0);

		expect(second.id).not.toBe(first.id);

		const rows = await db
			.select()
			.from(nuvsBlast)
			.where(eq(nuvsBlast.analysis_id, analysisId));
		expect(rows.map((row) => row.id)).toEqual([second.id]);
	});

	it("throws when the analysis does not exist", async () => {
		await expect(blastNuvs(db, 123456, 0)).rejects.toBeInstanceOf(
			AnalysisNotFoundError,
		);
	});

	it("refuses an analysis that is not NuVs", async () => {
		const analysisId = await seedNuvs({ workflow: "pathoscope" });

		await expect(blastNuvs(db, analysisId, 0)).rejects.toBeInstanceOf(
			AnalysisNotNuvsError,
		);
	});

	it("refuses an analysis that is still running", async () => {
		const analysisId = await seedNuvs({ ready: false });

		await expect(blastNuvs(db, analysisId, 0)).rejects.toBeInstanceOf(
			AnalysisRunningError,
		);
	});

	it("refuses a sequence index with no contig", async () => {
		const analysisId = await seedNuvs();

		await expect(blastNuvs(db, analysisId, 7)).rejects.toBeInstanceOf(
			AnalysisSequenceNotFoundError,
		);

		expect(await db.select().from(nuvsBlast)).toHaveLength(0);
	});
});

describe("findNuvsSequenceByIndex", () => {
	it("returns the contig at the index", () => {
		expect(
			findNuvsSequenceByIndex(
				{ hits: [{ index: 0, sequence: "ATGC" }, { index: 1 }] },
				0,
			),
		).toBe("ATGC");
	});

	it("returns an empty string for a contig with no sequence", () => {
		expect(findNuvsSequenceByIndex({ hits: [{ index: 1 }] }, 1)).toBe("");
	});

	it("returns null for null results, no hits, or no match", () => {
		expect(findNuvsSequenceByIndex(null, 0)).toBeNull();
		expect(findNuvsSequenceByIndex({}, 0)).toBeNull();
		expect(findNuvsSequenceByIndex({ hits: [] }, 0)).toBeNull();
		expect(
			findNuvsSequenceByIndex({ hits: [{ index: 1, sequence: "A" }] }, 0),
		).toBeNull();
	});

	it("throws when two contigs share an index", () => {
		// Picking one arbitrarily would BLAST the wrong sequence.
		expect(() =>
			findNuvsSequenceByIndex(
				{
					hits: [
						{ index: 0, sequence: "ATGC" },
						{ index: 0, sequence: "GGTT" },
					],
				},
				0,
			),
		).toThrow("More than one sequence with index 0");
	});
});
