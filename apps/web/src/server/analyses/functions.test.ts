import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import {
	analyses,
	analysisSubtractions,
	nuvsBlast,
} from "@virtool/data/db/schema/analyses";
import { indexes } from "@virtool/data/db/schema/indexes";
import { jobs } from "@virtool/data/db/schema/jobs";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { legacySamples } from "@virtool/data/db/schema/samples";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const getRequest = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

// The handlers read the `db` singleton at module scope. A getter defers the
// read until a handler actually runs, by which point beforeAll has pointed it
// at this file's isolated database.
let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
	storage,
}));

const storage = new MemoryStorage();

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError } = await import("../auth/middleware");
const { ClientError } = await import("../errors");
const { seedUser } = await import("@virtool/data/auth/test/fixtures");
const { signIn } = await import("../auth/test/fixtures");

let database: TestDatabase;
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
	vi.clearAllMocks();

	await db.delete(nuvsBlast);
	await db.delete(analysisSubtractions);
	await db.delete(analyses);
	await db.delete(indexes);
	await db.delete(legacyReferences);
	await db.delete(legacySamples);
	await db.delete(jobs);
	await db.delete(sessions);
	await db.delete(users);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);

	ownerId = await seedUser(db, { handle: "owner" });
	referenceId = await seedReference();
	indexId = await seedIndex({ referenceId, ready: true });
});

/** Authenticate the next call as a new user with no administrator role. */
function signInAsNewUser(): Promise<number> {
	return signIn(db, getRequest, { handle: `caller-${Math.random()}` });
}

async function seedReference(
	overrides: Partial<typeof legacyReferences.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({ name: `Reference ${Math.random()}`, ...overrides })
			.returning({ id: legacyReferences.id }),
	).id;
}

async function seedIndex(values: {
	referenceId: number;
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
				storage_key: `index-${values.referenceId}-${Math.random()}`,
				user_id: 1,
				version: 1,
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
				sample: String(overrides.sample_id ?? 0),
				// A Postgres-native analysis: no legacy id, so a delete never reaches
				// object storage.
				legacy_id: null,
				reference_id: referenceId,
				index_id: indexId,
				user_id: ownerId,
				...overrides,
			})
			.returning({ id: analyses.id }),
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

/** An analysis on a sample the caller may read but not write. */
async function seedReadOnlyAnalysis(
	overrides: Partial<typeof analyses.$inferInsert> = {},
): Promise<number> {
	const sampleId = await seedSample({ all_read: true, all_write: false });

	return seedAnalysis({ sample_id: sampleId, ...overrides });
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("getAnalysis", () => {
	it("returns 404 for an analysis that does not exist", async () => {
		await signInAsNewUser();

		await expect(
			call("getAnalysisFn", { analysisId: 123456 }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
		expect(setResponseStatus).not.toHaveBeenCalledWith(403);
	});

	it("returns 403 when the caller may not read the parent sample", async () => {
		const sampleId = await seedSample({ all_read: false });
		const analysisId = await seedAnalysis({ sample_id: sampleId });

		await signInAsNewUser();

		await expect(call("getAnalysisFn", { analysisId })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("allows a caller holding only the sample's read right", async () => {
		const analysisId = await seedReadOnlyAnalysis();

		await signInAsNewUser();

		const analysis = (await call("getAnalysisFn", { analysisId })) as {
			id: number;
		};

		expect(analysis.id).toBe(analysisId);
	});
});

describe("getAnalysisResults", () => {
	it("returns 404 for an analysis that does not exist", async () => {
		await signInAsNewUser();

		await expect(
			call("getAnalysisResultsFn", { analysisId: 123456 }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
		expect(setResponseStatus).not.toHaveBeenCalledWith(403);
	});

	it("returns 403 when the caller may not read the parent sample", async () => {
		const sampleId = await seedSample({ all_read: false });
		const analysisId = await seedAnalysis({ sample_id: sampleId });

		await signInAsNewUser();

		await expect(
			call("getAnalysisResultsFn", { analysisId }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("allows a caller holding only the sample's read right", async () => {
		const analysisId = await seedReadOnlyAnalysis({
			ready: true,
			results: { hits: [], read_count: 12, subtracted_count: 0 },
			workflow: "pathoscope",
		});

		await signInAsNewUser();

		expect(await call("getAnalysisResultsFn", { analysisId })).toEqual({
			hits: [],
			readCount: 12,
			subtractedCount: 0,
		});
	});
});

describe("createAnalysis", () => {
	function values(sampleId: number, overrides: Record<string, unknown> = {}) {
		return {
			sampleId,
			refId: referenceId,
			subtractionIds: [],
			workflow: "nuvs",
			...overrides,
		};
	}

	it("returns 404 for a sample that does not exist", async () => {
		await signInAsNewUser();

		await expect(
			call("createAnalysisFn", values(123456)),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
		expect(setResponseStatus).not.toHaveBeenCalledWith(403);
	});

	it("refuses a caller holding only the sample's read right", async () => {
		const sampleId = await seedSample({ all_read: true, all_write: false });

		await signInAsNewUser();

		await expect(
			call("createAnalysisFn", values(sampleId)),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(await db.select().from(analyses)).toHaveLength(0);
	});

	it("returns 409 for an archived reference", async () => {
		const sampleId = await seedSample({ all_write: true });
		const archived = await seedReference({ archived: true });
		await seedIndex({ referenceId: archived, ready: true });

		await signInAsNewUser();

		await expect(
			call("createAnalysisFn", values(sampleId, { refId: archived })),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("returns 409 when the reference has no ready index", async () => {
		const sampleId = await seedSample({ all_write: true });
		const unbuilt = await seedReference();
		await seedIndex({ referenceId: unbuilt, ready: false });

		await signInAsNewUser();

		await expect(
			call("createAnalysisFn", values(sampleId, { refId: unbuilt })),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("returns 201 and the new analysis for a caller with write rights", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });

		const analysis = (await call("createAnalysisFn", values(sampleId))) as {
			id: number;
			ready: boolean;
			workflow: string;
		};

		expect(analysis.workflow).toBe("nuvs");
		expect(analysis.ready).toBe(false);
		expect(setResponseStatus).toHaveBeenCalledWith(201);

		const [row] = await db
			.select({ user_id: analyses.user_id })
			.from(analyses)
			.where(eq(analyses.id, analysis.id));
		expect(row?.user_id).toBe(userId);
	});
});

describe("deleteAnalysis", () => {
	it("returns 404 for an analysis that does not exist", async () => {
		await signInAsNewUser();

		await expect(
			call("deleteAnalysisFn", { analysisId: 123456 }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("refuses a caller holding only the sample's read right", async () => {
		const analysisId = await seedReadOnlyAnalysis();

		await signInAsNewUser();

		await expect(
			call("deleteAnalysisFn", { analysisId }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(await db.select().from(analyses)).toHaveLength(1);
	});

	it("returns 409 for an analysis whose job is still running", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			ready: false,
			job_id: await seedJob({ state: "running", user_id: userId }),
		});

		await expect(
			call("deleteAnalysisFn", { analysisId }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(409);

		// The analysis must survive the rejected delete.
		expect(
			await db.select().from(analyses).where(eq(analyses.id, analysisId)),
		).toHaveLength(1);
	});

	it("deletes an unready analysis whose job failed", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			ready: false,
			job_id: await seedJob({ state: "failed", user_id: userId }),
		});

		await expect(call("deleteAnalysisFn", { analysisId })).resolves.toBeNull();
		expect(await db.select().from(analyses)).toHaveLength(0);
	});

	it("deletes the analysis for a caller with write rights", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({ sample_id: sampleId });

		await expect(call("deleteAnalysisFn", { analysisId })).resolves.toBeNull();
		expect(await db.select().from(analyses)).toHaveLength(0);
	});
});

describe("blastNuvs", () => {
	const results = { hits: [{ index: 0, sequence: "ATGCATGC", orfs: [] }] };

	it("refuses a caller holding only the sample's read right", async () => {
		const analysisId = await seedReadOnlyAnalysis({ results });

		await signInAsNewUser();

		await expect(
			call("blastNuvsFn", { analysisId, sequenceIndex: 0 }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(await db.select().from(nuvsBlast)).toHaveLength(0);
	});

	it("returns 409 for an analysis that is not NuVs", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({
			sample_id: sampleId,
			workflow: "pathoscope",
			results,
		});

		await expect(
			call("blastNuvsFn", { analysisId, sequenceIndex: 0 }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("returns 404 when there is no contig at the sequence index", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({ sample_id: sampleId, results });

		await expect(
			call("blastNuvsFn", { analysisId, sequenceIndex: 4 }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("returns 201 and the pending BLAST record for a caller with write rights", async () => {
		const userId = await signInAsNewUser();
		const sampleId = await seedSample({ user_id: userId });
		const analysisId = await seedAnalysis({ sample_id: sampleId, results });

		const blast = (await call("blastNuvsFn", {
			analysisId,
			sequenceIndex: 0,
		})) as { ready: boolean; sequenceIndex: number };

		expect(blast.ready).toBe(false);
		expect(blast.sequenceIndex).toBe(0);
		expect(setResponseStatus).toHaveBeenCalledWith(201);
		expect(await db.select().from(nuvsBlast)).toHaveLength(1);
	});
});
