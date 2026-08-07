import { isJobStateTerminal, type SearchResult } from "@virtool/contracts";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { analyses } from "../db/schema/analyses";
import { indexes } from "../db/schema/indexes";
import { type JobClaim, type JobStep, jobs } from "../db/schema/jobs";
import { legacySamples } from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { users } from "../db/schema/users";
import { withTimeout } from "../db/timeout";
import { AppError } from "../errors";

/** The canonical list of a job's lifecycle states. */
export const JOB_STATES = [
	"cancelled",
	"failed",
	"pending",
	"running",
	"succeeded",
] as const;

/** One of a job's lifecycle states. */
export type JobState = (typeof JOB_STATES)[number];

/**
 * The states a job can still leave — `pending` and `running`.
 *
 * Derived rather than written out, so it cannot fall out of step with
 * {@link JOB_STATES} or with `isJobStateTerminal`.
 */
export const NON_TERMINAL_JOB_STATES = JOB_STATES.filter(
	(state) => !isJobStateTerminal(state),
);

/** A job as it appears in a search result list. */
export type JobMinimal = {
	id: number;
	created_at: Date;
	progress: number;
	state: string;
	user: { id: number; handle: string };
	workflow: string;
};

/** A full job, as returned by the detail endpoint. */
export type Job = {
	args: Record<string, string>;
	id: number;
	claim: JobClaim | null;
	claimed_at: Date | null;
	created_at: Date;
	finished_at: Date | null;
	progress: number;
	state: string;
	steps: JobStep[] | null;
	user: { id: number; handle: string };
	workflow: string;
};

/** A page of jobs, with per-state/workflow counts attached. */
export type JobSearchResult = SearchResult & {
	counts: Record<string, Record<string, number>>;
	items: JobMinimal[];
};

/** Filters and pagination accepted by {@link findJobs}. */
export type FindJobsOptions = {
	page: number;
	perPage: number;
	states: JobState[];
};

/** Thrown when a requested job does not exist. */
export class JobNotFoundError extends AppError {}

// Mirror of the Python `compute_progress` helper: terminal jobs are 100%, a
// running job is the fraction of its steps that have started, everything else
// is 0%.
function computeProgress(state: string, steps: JobStep[] | null): number {
	if (isJobStateTerminal(state)) {
		return 100;
	}

	if (state !== "running" || !steps || steps.length === 0) {
		return 0;
	}

	const started = steps.filter((step) => step.started_at != null).length;
	return Math.floor((started / steps.length) * 100);
}

function buildCounts(
	rows: { state: string; workflow: string; count: number }[],
): Record<string, Record<string, number>> {
	const counts: Record<string, Record<string, number>> = {};

	// Seed every state so empty states report 0 rather than going missing.
	for (const state of JOB_STATES) {
		counts[state] = {};
	}

	for (const row of rows) {
		const workflowCounts = counts[row.state] ?? {};
		counts[row.state] = workflowCounts;
		workflowCounts[row.workflow] = row.count;
	}

	return counts;
}

export async function findJobs(
	db: Db,
	{ page, perPage, states }: FindJobsOptions,
): Promise<JobSearchResult> {
	// TODO: the Python endpoint also accepts a `users` filter; add it here if a
	// caller needs to scope jobs by user.
	const stateFilter = states.length ? inArray(jobs.state, states) : undefined;

	const [countRows, totalCountRows, foundCountRows, rows] = await Promise.all([
		db
			.select({
				state: jobs.state,
				workflow: jobs.workflow,
				count: count(),
			})
			.from(jobs)
			.groupBy(jobs.state, jobs.workflow),
		db.select({ value: count() }).from(jobs),
		// Without a state filter the found count equals the total count, so
		// skip the redundant query and reuse totalCount below.
		stateFilter
			? db.select({ value: count() }).from(jobs).where(stateFilter)
			: undefined,
		db
			.select({
				id: jobs.id,
				created_at: jobs.created_at,
				state: jobs.state,
				steps: jobs.steps,
				workflow: jobs.workflow,
				userId: users.id,
				handle: users.handle,
			})
			.from(jobs)
			.innerJoin(users, eq(jobs.user_id, users.id))
			.where(stateFilter)
			.orderBy(desc(jobs.created_at))
			.offset((page - 1) * perPage)
			.limit(perPage),
	]);

	const totalCount = takeFirstOrThrow(totalCountRows).value;
	const foundCount = foundCountRows
		? takeFirstOrThrow(foundCountRows).value
		: totalCount;

	const items = rows.map((row) => ({
		id: row.id,
		created_at: row.created_at,
		progress: computeProgress(row.state, row.steps),
		state: row.state,
		user: { id: row.userId, handle: row.handle },
		workflow: row.workflow,
	}));

	return {
		counts: buildCounts(countRows),
		foundCount,
		items,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		totalCount,
	};
}

type JobRowWithResources = Awaited<
	ReturnType<typeof selectJobsWithResources>
>[number];

function toJob(row: JobRowWithResources): Job {
	// `args` is reconstructed from the related resources — the legacy Mongo
	// `args` field is not stored as a column. Every resource is found on its
	// owning row via a reverse `job_id` foreign key, and its integer primary key
	// is the public identifier the client links to; `args` is a string map, so
	// each id is stringified.
	const args: Record<string, string> = {};
	if (row.sample_id != null) {
		args.sample_id = String(row.sample_id);
	}
	if (row.index_id != null) {
		args.index_id = String(row.index_id);
	}
	if (row.subtraction_id != null) {
		args.subtraction_id = String(row.subtraction_id);
	}
	if (row.analysis_id != null) {
		args.analysis_id = String(row.analysis_id);
	}

	return {
		args,
		id: row.id,
		claim: row.claim ?? null,
		claimed_at: row.claimed_at,
		created_at: row.created_at,
		finished_at: row.finished_at,
		progress: computeProgress(row.state, row.steps),
		state: row.state,
		steps: row.steps,
		user: { id: row.userId, handle: row.handle },
		workflow: row.workflow,
	};
}

function selectJobsWithResources(db: Db) {
	return db
		.select({
			id: jobs.id,
			claim: jobs.claim,
			claimed_at: jobs.claimed_at,
			created_at: jobs.created_at,
			finished_at: jobs.finished_at,
			state: jobs.state,
			steps: jobs.steps,
			workflow: jobs.workflow,
			userId: users.id,
			handle: users.handle,
			sample_id: legacySamples.id,
			index_id: indexes.id,
			subtraction_id: subtractions.id,
			analysis_id: analyses.id,
		})
		.from(jobs)
		.innerJoin(users, eq(jobs.user_id, users.id))
		.leftJoin(legacySamples, eq(jobs.id, legacySamples.job_id))
		.leftJoin(indexes, eq(jobs.id, indexes.job_id))
		.leftJoin(subtractions, eq(jobs.id, subtractions.job_id))
		.leftJoin(analyses, eq(jobs.id, analyses.job_id));
}

/**
 * Read several jobs by id in one query.
 *
 * Ids that match no job are simply absent from the result — a batch is a
 * best-effort read, so one deleted job does not fail the rest. Order is not
 * guaranteed; callers key off `id`.
 */
export async function getJobs(db: Db, jobIds: number[]): Promise<Job[]> {
	if (jobIds.length === 0) {
		return [];
	}

	const rows = await selectJobsWithResources(db).where(
		inArray(jobs.id, jobIds),
	);

	// The resource joins are left joins on tables that hold at most one row per
	// job, but nothing in this read-only mirror constrains that, so collapse to
	// the first row per id rather than emitting a job twice.
	const byId = new Map<number, JobRowWithResources>();
	for (const row of rows) {
		if (!byId.has(row.id)) {
			byId.set(row.id, row);
		}
	}

	return [...byId.values()].map(toJob);
}

export async function getJob(db: Db, jobId: number): Promise<Job> {
	const [job] = await getJobs(db, [jobId]);

	if (!job) {
		throw new JobNotFoundError();
	}

	return job;
}

/**
 * Create a new job in the `pending` state and return its id.
 *
 * A pending job in Postgres is claimable by any workflow runner, so this is all
 * that is needed to schedule work — no key, claim, or steps are set here; the
 * runner writes those when it claims the job. A job's arguments are not stored:
 * they are recomposed on read from the owning resource's reverse `job_id`
 * foreign key, so the caller must create the owning row (e.g. the sample) in the
 * same transaction, before the job becomes visible to a runner.
 *
 * Takes `DbOrTx` so it can participate in the caller's transaction; the caller
 * commits.
 */
export async function createJob(
	db: DbOrTx,
	workflow: string,
	userId: number,
): Promise<number> {
	const row = takeFirstOrThrow(
		await db
			.insert(jobs)
			.values({
				acquired: false,
				created_at: new Date(),
				state: "pending",
				user_id: userId,
				workflow,
			})
			.returning({ id: jobs.id }),
	);

	return row.id;
}

/** A count of jobs sharing one workflow and state. */
export type JobCount = { workflow: string; state: string; count: number };

/** How long the oldest job still waiting for a runner has waited. */
export type OldestPendingJobAge = { workflow: string; ageSeconds: number };

/** The non-terminal job queue as a `/metrics` scrape reports it. */
export type JobQueueSnapshot = {
	counts: JobCount[];
	oldestPendingAges: OldestPendingJobAge[];
};

/**
 * How long a scrape waits on the job-queue reads before abandoning them.
 *
 * Matched to the pool probe's bound, and for the same reason: these run on the
 * pool the jobs API serves workflows from, so a saturated pool queues them
 * client-side where nothing rejects.
 */
export const JOB_QUEUE_PROBE_TIMEOUT_MS = 2000;

/**
 * Count the jobs in each workflow and non-terminal state.
 *
 * **Deliberately restricted to `pending` and `running`.** Counting every job
 * ever run is a scan that grows forever, and the schema is Python-owned — there
 * is no index to add from this side. Terminal totals are also the wrong
 * instrument: a gauge over accumulated history is a counter wearing the wrong
 * hat, and failure rate belongs on a counter incremented when a job finishes.
 */
export async function readJobCounts(db: Db): Promise<JobCount[]> {
	return db
		.select({
			workflow: jobs.workflow,
			state: jobs.state,
			count: count(),
		})
		.from(jobs)
		.where(inArray(jobs.state, NON_TERMINAL_JOB_STATES))
		.groupBy(jobs.workflow, jobs.state);
}

/**
 * Age the oldest job still waiting for a runner, per workflow.
 *
 * Queue depth alone cannot tell a busy fleet from a stuck one; the age of the
 * oldest waiting job can.
 *
 * The subtraction happens in Postgres, and `created_at` is pinned to UTC on the
 * way into it. The column is a naive `timestamp`, so left to the session's time
 * zone the age would be wrong by that offset — and both writers, Python and
 * Drizzle, store UTC.
 */
export async function readOldestPendingJobAges(
	db: Db,
): Promise<OldestPendingJobAge[]> {
	return db
		.select({
			workflow: jobs.workflow,
			ageSeconds: sql<number>`
				extract(epoch from (now() - (min(${jobs.created_at}) at time zone 'UTC')))
			`.mapWith(Number),
		})
		.from(jobs)
		.where(eq(jobs.state, "pending"))
		.groupBy(jobs.workflow);
}

/**
 * Both job-queue reads at once, bounded by {@link JOB_QUEUE_PROBE_TIMEOUT_MS}.
 *
 * This is what a `/metrics` handler should call. The two reads are independent,
 * so they go out concurrently and share one deadline.
 *
 * Still throws on timeout or query failure. A caller drops these series and
 * logs, rather than failing the whole scrape.
 */
export function readJobQueueBounded(
	db: Db,
	timeoutMs: number = JOB_QUEUE_PROBE_TIMEOUT_MS,
): Promise<JobQueueSnapshot> {
	return withTimeout(
		Promise.all([readJobCounts(db), readOldestPendingJobAges(db)]).then(
			([counts, oldestPendingAges]) => ({ counts, oldestPendingAges }),
		),
		timeoutMs,
	);
}
