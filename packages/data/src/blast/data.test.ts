import { eq } from "drizzle-orm";
import { zipSync } from "fflate";
import {
	afterAll,
	afterEach,
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
import { analyses, nuvsBlast } from "../db/schema/analyses";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import { sweepBlasts } from "./data";

let database: TestDatabase;
let db: Db;
let userId: number;

const SEQUENCE = "ATGCATGCATGC";

const REPORT = {
	BlastOutput2: {
		report: {
			program: "blastn",
			version: "BLASTN 2.15.0+",
			params: { expect: 10 },
			search_target: { db: "nr" },
			results: {
				search: {
					query_masking: [{ from: 0, to: 4 }],
					stat: { db_num: 100 },
					hits: [
						{
							len: 1200,
							description: [
								{
									accession: "NC_003977",
									taxid: 10407,
									title: "Hepatitis B virus",
									sciname: "Hepatitis B virus",
								},
							],
							hsps: [
								{
									align_len: 300,
									bit_score: 540.2,
									evalue: 1e-150,
									gaps: 0,
									identity: 299,
									score: 600,
								},
							],
						},
					],
				},
			},
		},
	},
};

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(nuvsBlast);
	await db.delete(analyses);
	await db.delete(users);

	userId = await seedUser(db, { handle: "owner" });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function minutesAgo(minutes: number): Date {
	return new Date(Date.now() - minutes * 60_000);
}

function secondsAgo(seconds: number): Date {
	return new Date(Date.now() - seconds * 1000);
}

async function seedAnalysis(indices: number[] = [0]): Promise<number> {
	const now = new Date();

	return takeFirstOrThrow(
		await db
			.insert(analyses)
			.values({
				created_at: now,
				updated_at: now,
				workflow: "nuvs",
				ready: true,
				results: {
					hits: indices.map((index) => ({
						index,
						sequence: `${SEQUENCE}${index}`,
						orfs: [],
					})),
				},
				sample: "0",
				user_id: userId,
			})
			.returning({ id: analyses.id }),
	).id;
}

async function seedBlast(
	analysisId: number,
	overrides: Partial<typeof nuvsBlast.$inferInsert> = {},
): Promise<number> {
	const now = new Date();

	return takeFirstOrThrow(
		await db
			.insert(nuvsBlast)
			.values({
				analysis_id: analysisId,
				sequence_index: 0,
				created_at: now,
				updated_at: now,
				last_checked_at: secondsAgo(60),
				interval: 3,
				ready: false,
				...overrides,
			})
			.returning({ id: nuvsBlast.id }),
	).id;
}

async function readBlast(id: number) {
	return (
		await db.select().from(nuvsBlast).where(eq(nuvsBlast.id, id)).limit(1)
	)[0];
}

async function readAnalysisUpdatedAt(id: number): Promise<Date> {
	return takeFirstOrThrow(
		await db
			.select({ updated_at: analyses.updated_at })
			.from(analyses)
			.where(eq(analyses.id, id))
			.limit(1),
	).updated_at;
}

const SUBMISSION_HTML = "<!--QBlastInfoBegin\n RID = RID001\nQBlastInfoEnd-->";

function zipResponse(rid: string, body: unknown): Response {
	const archive = zipSync({
		[`${rid}_1.json`]: new TextEncoder().encode(JSON.stringify(body)),
	});

	return new Response(archive as unknown as BodyInit, { status: 200 });
}

/**
 * Answer each NCBI exchange by the `CMD` and `FORMAT_OBJECT` it carries, which
 * is the only thing that tells the three request shapes apart.
 */
function stubNcbi(handlers: {
	check?: (rid: string) => Response | Promise<Response>;
	result?: (rid: string) => Response | Promise<Response>;
	submit?: () => Response | Promise<Response>;
}) {
	const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
		void init;

		const rid = url.searchParams.get("RID") ?? "";

		if (url.searchParams.get("CMD") === "Put") {
			return (
				handlers.submit?.() ?? new Response(SUBMISSION_HTML, { status: 200 })
			);
		}

		if (url.searchParams.get("FORMAT_OBJECT") === "SearchInfo") {
			return handlers.check?.(rid) ?? new Response("Status=WAITING");
		}

		return handlers.result?.(rid) ?? zipResponse(rid, REPORT);
	});

	vi.stubGlobal("fetch", fetchMock);

	return fetchMock;
}

describe("sweepBlasts", () => {
	describe("initialization", () => {
		it("submits the contig's sequence and stores the RID", async () => {
			const analysisId = await seedAnalysis([0, 3]);
			const blastId = await seedBlast(analysisId, { sequence_index: 3 });

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			const submission = fetchMock.mock.calls.find(
				([url]) => url.searchParams.get("CMD") === "Put",
			);

			expect(String((submission?.[1] as RequestInit | undefined)?.body)).toBe(
				`QUERY=${SEQUENCE}3`,
			);

			expect(await readBlast(blastId)).toMatchObject({
				rid: "RID001",
				ready: false,
				error: null,
			});
		});

		it("does not advance the interval on a successful submission", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, { interval: 3 });

			stubNcbi({});

			await sweepBlasts(db, testLogger);

			const row = await readBlast(blastId);

			expect(row?.interval).toBe(3);
			expect(row?.last_checked_at.getTime()).toBeGreaterThan(
				secondsAgo(10).getTime(),
			);
		});

		it("bumps the analysis's updated_at", async () => {
			const analysisId = await seedAnalysis();

			await db
				.update(analyses)
				.set({ updated_at: minutesAgo(120) })
				.where(eq(analyses.id, analysisId));

			await seedBlast(analysisId);

			stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(
				(await readAnalysisUpdatedAt(analysisId)).getTime(),
			).toBeGreaterThan(minutesAgo(1).getTime());
		});

		it("discards the RID when the row gained one while NCBI was answering", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId);

			stubNcbi({
				submit: async () => {
					// The user re-BLASTed the contig mid-flight: `blastNuvs` deleted this
					// row and inserted a replacement that has since been submitted.
					await db
						.update(nuvsBlast)
						.set({ rid: "NEWER" })
						.where(eq(nuvsBlast.id, blastId));

					return new Response(SUBMISSION_HTML, { status: 200 });
				},
			});

			await sweepBlasts(db, testLogger);

			expect((await readBlast(blastId))?.rid).toBe("NEWER");
		});

		it("backs the row off when the contig is gone from the analysis", async () => {
			const analysisId = await seedAnalysis([7]);
			const blastId = await seedBlast(analysisId, { sequence_index: 0 });

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(fetchMock).not.toHaveBeenCalled();
			expect((await readBlast(blastId))?.interval).toBe(8);
		});
	});

	describe("checking", () => {
		it("backs a waiting search off without emitting a result", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, {
				rid: "RID001",
				interval: 3,
			});

			stubNcbi({ check: () => new Response("Status=WAITING") });

			await sweepBlasts(db, testLogger);

			expect(await readBlast(blastId)).toMatchObject({
				interval: 8,
				ready: false,
				result: null,
				error: null,
			});
		});

		it("caps the backed-off interval", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, {
				rid: "RID001",
				interval: 75,
				last_checked_at: secondsAgo(120),
			});

			stubNcbi({ check: () => new Response("Status=WAITING") });

			await sweepBlasts(db, testLogger);

			expect((await readBlast(blastId))?.interval).toBe(75);
		});

		it("stores the formatted result once NCBI is ready", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, { rid: "RID001" });

			stubNcbi({ check: () => new Response("Status=READY") });

			await sweepBlasts(db, testLogger);

			const row = await readBlast(blastId);

			expect(row?.ready).toBe(true);
			expect(row?.error).toBeNull();

			const result = (row?.result ?? {}) as { hits?: unknown[] };

			expect(Object.keys(result).sort()).toEqual([
				"hits",
				"masking",
				"params",
				"program",
				"stat",
				"target",
				"version",
			]);
			expect(result.hits).toEqual([
				{
					accession: "NC_003977",
					align_len: 300,
					bit_score: 540.2,
					evalue: 1e-150,
					gaps: 0,
					identity: 299,
					len: 1200,
					name: "Hepatitis B virus",
					score: 600,
					taxid: 10407,
					title: "Hepatitis B virus",
				},
			]);
		});

		it.each(["Status=FAILED", "Status=UNKNOWN"])(
			"records %s as an error rather than an empty result",
			async (status) => {
				const analysisId = await seedAnalysis();
				const blastId = await seedBlast(analysisId, { rid: "RID001" });

				stubNcbi({ check: () => new Response(status) });

				await sweepBlasts(db, testLogger);

				const row = await readBlast(blastId);

				expect(row?.error).toBe("NCBI could not complete the search");
				expect(row?.ready).toBe(false);
				expect(row?.result).toBeNull();
			},
		);

		it("records an unreadable result as an error", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, { rid: "RID001" });

			stubNcbi({
				check: () => new Response("Status=READY"),
				result: () => new Response("<html>an outage page</html>"),
			});

			await sweepBlasts(db, testLogger);

			expect((await readBlast(blastId))?.error).toBe(
				"Unable to interpret NCBI result",
			);
		});

		it("backs off rather than recording an error when the fetch is refused", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, {
				rid: "RID001",
				interval: 3,
			});

			stubNcbi({
				check: () => new Response("Status=READY"),
				result: () => new Response("unavailable", { status: 503 }),
			});

			await sweepBlasts(db, testLogger);

			expect(await readBlast(blastId)).toMatchObject({
				error: null,
				interval: 8,
				ready: false,
			});
		});

		it("discards a result for a row whose RID has changed", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, { rid: "RID001" });

			stubNcbi({
				check: async () => {
					await db
						.update(nuvsBlast)
						.set({ rid: "NEWER" })
						.where(eq(nuvsBlast.id, blastId));

					return new Response("Status=READY");
				},
			});

			await sweepBlasts(db, testLogger);

			expect(await readBlast(blastId)).toMatchObject({
				rid: "NEWER",
				ready: false,
				result: null,
			});
		});
	});

	describe("selection", () => {
		it("ignores rows that are ready or carry an error", async () => {
			const analysisId = await seedAnalysis();

			await seedBlast(analysisId, { sequence_index: 0, ready: true });
			await seedBlast(analysisId, { sequence_index: 1, error: "boom" });

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("ignores a row whose interval has not elapsed", async () => {
			const analysisId = await seedAnalysis();

			await seedBlast(analysisId, {
				interval: 75,
				last_checked_at: secondsAgo(10),
			});

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("treats a null interval as the initial one", async () => {
			const analysisId = await seedAnalysis();

			await seedBlast(analysisId, {
				interval: null,
				last_checked_at: secondsAgo(5),
			});

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(fetchMock).toHaveBeenCalled();
		});
	});

	describe("expiry", () => {
		it("deletes a search that has outlived the timeout and bumps its analysis", async () => {
			const analysisId = await seedAnalysis();

			await db
				.update(analyses)
				.set({ updated_at: minutesAgo(120) })
				.where(eq(analyses.id, analysisId));

			const blastId = await seedBlast(analysisId, {
				created_at: minutesAgo(31),
				rid: "RID001",
			});

			const fetchMock = stubNcbi({});

			await sweepBlasts(db, testLogger);

			expect(await readBlast(blastId)).toBeUndefined();
			expect(fetchMock).not.toHaveBeenCalled();
			expect(
				(await readAnalysisUpdatedAt(analysisId)).getTime(),
			).toBeGreaterThan(minutesAgo(1).getTime());
		});

		it("leaves a search that is inside the timeout", async () => {
			const analysisId = await seedAnalysis();
			const blastId = await seedBlast(analysisId, {
				created_at: minutesAgo(29),
				rid: "RID001",
			});

			stubNcbi({ check: () => new Response("Status=WAITING") });

			await sweepBlasts(db, testLogger);

			expect(await readBlast(blastId)).toBeDefined();
		});
	});

	describe("failure isolation", () => {
		it("backs one row off without stopping its neighbours", async () => {
			const analysisId = await seedAnalysis([0, 1]);

			const failing = await seedBlast(analysisId, {
				sequence_index: 0,
				rid: "BAD",
			});
			const healthy = await seedBlast(analysisId, {
				sequence_index: 1,
				rid: "GOOD",
			});

			stubNcbi({
				check: (rid) =>
					rid === "BAD"
						? new Response("down", { status: 503 })
						: new Response("Status=READY"),
			});

			await sweepBlasts(db, testLogger);

			expect(await readBlast(failing)).toMatchObject({
				error: null,
				interval: 8,
			});
			expect((await readBlast(healthy))?.ready).toBe(true);
		});
	});

	describe("concurrency", () => {
		it("submits one search at a time and checks three", async () => {
			const analysisId = await seedAnalysis([0, 1, 2, 3, 4, 5, 6, 7]);

			for (const index of [0, 1, 2]) {
				await seedBlast(analysisId, { sequence_index: index });
			}

			for (const index of [3, 4, 5, 6, 7]) {
				await seedBlast(analysisId, {
					sequence_index: index,
					rid: `RID00${index}`,
				});
			}

			let submitting = 0;
			let peakSubmitting = 0;
			let checking = 0;
			let peakChecking = 0;

			async function settle(): Promise<void> {
				for (let i = 0; i < 5; i++) {
					await Promise.resolve();
				}
			}

			stubNcbi({
				submit: async () => {
					submitting++;
					peakSubmitting = Math.max(peakSubmitting, submitting);
					await settle();
					submitting--;

					return new Response(SUBMISSION_HTML, { status: 200 });
				},
				check: async () => {
					checking++;
					peakChecking = Math.max(peakChecking, checking);
					await settle();
					checking--;

					return new Response("Status=WAITING");
				},
			});

			await sweepBlasts(db, testLogger);

			expect(peakSubmitting).toBe(1);
			expect(peakChecking).toBe(3);
		});
	});
});
