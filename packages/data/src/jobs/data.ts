import {
	computeJobProgress,
	isJobStateTerminal,
	JobState,
	type SearchResult,
	type StoredJobClaim,
	type StoredJobStep,
} from "@virtool/contracts";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { hashToken, newJobKey } from "../auth/tokens";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { analyses } from "../db/schema/analyses";
import { indexes } from "../db/schema/indexes";
import { jobs } from "../db/schema/jobs";
import { legacySamples } from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { users } from "../db/schema/users";
import { withTimeout } from "../db/timeout";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/**
 * The states a job can still leave — `pending` and `running`.
 *
 * Derived rather than written out, so it cannot fall out of step with
 * `JobState` or with `isJobStateTerminal`.
 */
export const NON_TERMINAL_JOB_STATES = JobState.options.filter(
	(state) => !isJobStateTerminal(state),
);

/** A job as it appears in a search result list. */
export type JobMinimal = {
	id: number;
	createdAt: Date;
	progress: number;
	state: JobState;
	user: { id: number; handle: string };
	/**
	 * Deliberately open. `jobs.workflow` carries no CHECK constraint, so a row
	 * can name a workflow this build has never heard of.
	 */
	workflow: string;
};

/** A full job, as returned by the detail endpoint. */
export type Job = {
	args: Record<string, string>;
	id: number;
	claim: StoredJobClaim | null;
	claimedAt: Date | null;
	createdAt: Date;
	finishedAt: Date | null;
	pingedAt: Date | null;
	progress: number;
	state: JobState;
	steps: StoredJobStep[] | null;
	user: { id: number; handle: string };
	/** Open for the same reason as {@link JobMinimal.workflow}. */
	workflow: string;
};

/**
 * A page of jobs, with per-state/workflow counts attached.
 *
 * Every {@link JobState} is a key, whether or not anything is queued in it, so
 * a caller folding these into totals never has to reason about a missing one. A
 * row naming a state outside the union is dropped rather than adding a sixth
 * key: `jobs.state` is a `text` column, and no reader has anything to do with a
 * bucket it cannot name.
 */
export type JobSearchResult = SearchResult & {
	counts: Record<JobState, Record<string, number>>;
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

/** Thrown when no unclaimed job is waiting for the requested workflow. */
export class NoJobAvailableError extends AppError {}

/** Thrown when a job's step list holds no step with the requested id. */
export class JobStepNotFoundError extends AppError {}

/** Thrown when a step is started twice. */
export class JobStepAlreadyStartedError extends AppError {}

/** Thrown when a job is asked to do something it has already finished doing. */
export class JobTerminalStateError extends AppError {}

/** Thrown when a job that is not running is asked to finish. */
export class JobNotRunningError extends AppError {}

function buildCounts(
	rows: { state: string; workflow: string; count: number }[],
): Record<JobState, Record<string, number>> {
	// Spelled out rather than seeded from `JobState.options`, so the compiler
	// requires a new state to be added here rather than letting the record go
	// out with a key missing.
	const counts: Record<JobState, Record<string, number>> = {
		cancelled: {},
		failed: {},
		pending: {},
		running: {},
		succeeded: {},
	};

	for (const row of rows) {
		const state = JobState.safeParse(row.state);

		if (state.success) {
			counts[state.data][row.workflow] = row.count;
		}
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
				createdAt: jobs.created_at,
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
		createdAt: row.createdAt,
		progress: computeJobProgress(row.state, row.steps),
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
		claimedAt: row.claimedAt,
		createdAt: row.createdAt,
		finishedAt: row.finishedAt,
		pingedAt: row.pingedAt,
		progress: computeJobProgress(row.state, row.steps),
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
			claimedAt: jobs.claimed_at,
			createdAt: jobs.created_at,
			finishedAt: jobs.finished_at,
			pingedAt: jobs.pinged_at,
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

/** The runner metadata and step list a claim carries. */
export type ClaimJobValues = {
	claim: StoredJobClaim;
	steps: Omit<StoredJobStep, "started_at">[];
};

/** A job just claimed, with the plaintext key its runner will authenticate with. */
export type ClaimedJob = {
	id: number;
	claim: StoredJobClaim;
	claimedAt: Date;
	createdAt: Date;
	/** Returned once and never stored in the clear. */
	key: string;
	steps: StoredJobStep[];
	user: { id: number; handle: string };
	workflow: string;
};

/**
 * Claim the oldest job waiting on `workflow` for the runner described by
 * `values`.
 *
 * The select takes `FOR UPDATE SKIP LOCKED` over a one-row window, which is
 * what makes a fleet of runners starting together safe: each locks a different
 * row rather than queueing on the same one and then finding it taken. Without
 * `SKIP LOCKED` a wave of pods serialises, and every one but the first wakes to
 * a row that is no longer pending.
 *
 * The key is generated here and only its digest is written, so the plaintext on
 * the returned object is the one and only copy — nothing can reissue it, and a
 * runner that loses it cannot finish its job.
 *
 * @throws {NoJobAvailableError} when nothing is waiting.
 */
export async function claimJob(
	db: Db,
	workflow: string,
	values: ClaimJobValues,
): Promise<ClaimedJob> {
	const key = newJobKey();
	const now = new Date();

	const steps: StoredJobStep[] = values.steps.map((step) => ({
		description: step.description,
		id: step.id,
		name: step.name,
		started_at: null,
	}));

	const claimed = await db.transaction(async (tx) => {
		const [pending] = await tx
			.select({
				id: jobs.id,
				createdAt: jobs.created_at,
				user_id: jobs.user_id,
			})
			.from(jobs)
			.where(
				and(
					eq(jobs.workflow, workflow),
					eq(jobs.acquired, false),
					eq(jobs.state, "pending"),
				),
			)
			.orderBy(asc(jobs.created_at))
			.limit(1)
			.for("update", { skipLocked: true });

		if (!pending) {
			return null;
		}

		await tx
			.update(jobs)
			.set({
				acquired: true,
				claim: values.claim,
				claimed_at: now,
				key: hashToken(key),
				pinged_at: now,
				state: "running",
				steps,
			})
			.where(eq(jobs.id, pending.id));

		const user = takeFirstOrThrow(
			await tx
				.select({ id: users.id, handle: users.handle })
				.from(users)
				.where(eq(users.id, pending.user_id))
				.limit(1),
		);

		return { id: pending.id, createdAt: pending.createdAt, user };
	});

	if (!claimed) {
		throw new NoJobAvailableError();
	}

	await emit("jobs", claimed.id, "update");

	return {
		id: claimed.id,
		claim: values.claim,
		claimedAt: now,
		createdAt: claimed.createdAt,
		key,
		steps,
		user: claimed.user,
		workflow,
	};
}

/**
 * Record a heartbeat from the runner holding `jobId`.
 *
 * The only lifecycle call that emits nothing. A running job pings every five
 * seconds and every job on screen holds its own detail query, so a frame per
 * ping would cost a refetch per job per five seconds for a timestamp no view
 * displays.
 *
 * @throws {JobNotFoundError} when no such job exists.
 */
export async function pingJob(db: Db, jobId: number): Promise<Date> {
	const pingedAt = new Date();

	const updated = await db
		.update(jobs)
		.set({ pinged_at: pingedAt })
		.where(eq(jobs.id, jobId))
		.returning({ id: jobs.id });

	if (updated.length === 0) {
		throw new JobNotFoundError();
	}

	return pingedAt;
}

/** A step that has just been started, so its `started_at` is set by construction. */
export type StartedJobStep = StoredJobStep & { started_at: string };

/**
 * Stamp `started_at` on one step of a job's step list.
 *
 * The list is a JSONB array, so there is no way to address one element from
 * SQL — the whole array is read, one element replaced, and the whole array
 * written back. That read-modify-write is why the row is locked `FOR UPDATE`
 * for the length of the transaction: two steps starting at once would otherwise
 * each write back an array built from the state before the other, and the
 * loser's timestamp would vanish.
 *
 * @throws {JobNotFoundError} when no such job exists.
 * @throws {JobTerminalStateError} when the job has already finished.
 * @throws {JobStepNotFoundError} when the job's steps hold no such id.
 * @throws {JobStepAlreadyStartedError} when the step already has a start time.
 */
export async function startJobStep(
	db: Db,
	jobId: number,
	stepId: string,
): Promise<StartedJobStep> {
	const startedAt = new Date();

	const step = await db.transaction(async (tx) => {
		const [job] = await tx
			.select({ state: jobs.state, steps: jobs.steps })
			.from(jobs)
			.where(eq(jobs.id, jobId))
			.limit(1)
			.for("update");

		if (!job) {
			throw new JobNotFoundError();
		}

		if (isJobStateTerminal(job.state)) {
			throw new JobTerminalStateError();
		}

		const found = job.steps?.find((each) => each.id === stepId);

		if (!job.steps || !found) {
			throw new JobStepNotFoundError();
		}

		if (found.started_at !== null) {
			throw new JobStepAlreadyStartedError();
		}

		const started: StartedJobStep = {
			...found,
			started_at: startedAt.toISOString(),
		};

		const steps = job.steps.map((each) =>
			each.id === stepId ? started : each,
		);

		await tx.update(jobs).set({ steps }).where(eq(jobs.id, jobId));

		return started;
	});

	await emit("jobs", jobId, "update");

	return step;
}

/**
 * Move a running job to `succeeded`.
 *
 * The success half of the terminal transition, and the only one a runner makes.
 * There is deliberately no failure counterpart: a job fails by being cancelled
 * or by the jobs API's stalled-job sweep, neither of which the runner drives.
 *
 * @throws {JobNotFoundError} when no such job exists.
 * @throws {JobNotRunningError} when the job is in any other state, which is
 *   what makes a second finish a conflict rather than a silent no-op.
 */
export async function finishJob(db: Db, jobId: number): Promise<Job> {
	await db.transaction(async (tx) => {
		const [job] = await tx
			.select({ state: jobs.state })
			.from(jobs)
			.where(eq(jobs.id, jobId))
			.limit(1)
			.for("update");

		if (!job) {
			throw new JobNotFoundError();
		}

		if (job.state !== "running") {
			throw new JobNotRunningError();
		}

		await tx
			.update(jobs)
			.set({ finished_at: new Date(), state: "succeeded" })
			.where(eq(jobs.id, jobId));
	});

	await emit("jobs", jobId, "update");

	return getJob(db, jobId);
}

/**
 * How long a running job may go without a ping before it is timed out.
 *
 * Not a config key: every sweep has to agree on which rows are stale, so this
 * is fleet-wide application state rather than a fact about the pod reading it.
 *
 * Unrelated to the interval at which the spawner creates a `timeout_jobs` row.
 * One is how long a job may go silent, the other how often the sweep runs; the
 * two are not views of one interval and must not be collapsed.
 */
export const JOB_TIMEOUT_SECONDS = 300;

/**
 * Fail every running job whose runner has stopped pinging, stamping
 * `finished_at`, and return the ids in no particular order.
 *
 * A timed-out job is written as an ordinary failure — no distinct state, no
 * appended step, no error string, and `claim` / `claimed_at` left exactly as
 * the dead runner wrote them. It is indistinguishable from any other failure
 * and must stay so: `JobState` is a five-member union consumed on both sides of
 * the wire, so a sixth member is a change to the client contract rather than a
 * tidy-up. `computeJobProgress` returns 100 for `failed`, so a timed-out job's
 * progress bar snaps to full the moment the state flips.
 *
 * **Deliberately minimal, and expected to be subsumed.** The jobs control plane
 * will own job state transitions properly — the runner-side lifecycle, `claim`
 * / `claimed_at`, ping writes and cancellation — and will absorb this or
 * replace it outright. Do not grow it into a general `setJobState`, and do not
 * add a ping writer to it.
 *
 * One conditional statement, so a concurrent sweep re-evaluates
 * `state = 'running'` once the first commits and matches nothing rather than
 * blocking on its row locks. That leaves no transaction to manage and no lock
 * reasoning to get wrong.
 *
 * The same predicate is what makes it idempotent, as a reclaimed task requires:
 * a re-run matches only rows still running and still stale, so a body restarted
 * from step zero neither re-fails a job nor moves a `finished_at` it already
 * wrote.
 *
 * `thresholdSeconds` exists so a test need not wait five real minutes.
 */
export async function timeoutStalledJobs(
	db: Db,
	options: { thresholdSeconds?: number } = {},
): Promise<number[]> {
	const { thresholdSeconds = JOB_TIMEOUT_SECONDS } = options;

	/* `timezone('utc', clock_timestamp())` on both the write and the cutoff.
	   `finished_at` is a naive `timestamp` holding UTC, so a value read through
	   the session `TimeZone` is wrong by that offset, and `now()` freezes at
	   transaction start. The pair has to match: a cutoff and a stamp taken on
	   different clocks times out either everything or nothing.

	   A job that has never been pinged is never timed out — `pinged_at < ...` is
	   NULL for it, and so falsy. That is deliberate rather than an oversight: a
	   queued job is not pinging by definition, so do not COALESCE it. */
	const timedOut = await db
		.update(jobs)
		.set({
			finished_at: sql`timezone('utc', clock_timestamp())`,
			state: "failed",
		})
		.where(
			and(
				eq(jobs.state, "running"),
				sql`${jobs.pinged_at} < timezone('utc', clock_timestamp()) - make_interval(secs => ${thresholdSeconds}::double precision)`,
			),
		)
		.returning({ id: jobs.id });

	for (const { id } of timedOut) {
		await emit("jobs", id, "update");
	}

	return timedOut.map(({ id }) => id);
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
