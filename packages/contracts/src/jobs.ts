import { z } from "zod";
import type { SearchResult } from "./search";
import { UserNested } from "./users";

/** A job's lifecycle state. Shared by every resource that embeds a job. */
export const JobState = z.enum([
	"cancelled",
	"failed",
	"pending",
	"running",
	"succeeded",
]);

export type JobState = z.infer<typeof JobState>;

/**
 * Whether a state is one a job never leaves.
 *
 * Mirrors Python's `TERMINAL_JOB_STATES`. Takes a plain `string` because
 * `jobs.state` is a `text` column, not an enum — a row written by a future
 * Python release can hold a state this union has never heard of, and such a
 * state is not terminal until it is named here.
 */
export function isJobStateTerminal(state: string): boolean {
	return state === "cancelled" || state === "failed" || state === "succeeded";
}

/**
 * Whether a job reached a terminal state without producing anything.
 *
 * Deliberately narrower than {@link isJobStateTerminal}: `succeeded` is
 * terminal and is not this. A subtraction whose create job ends this way is
 * stuck at `ready: false` with no files, and nothing will ever finish it — the
 * detail view has to offer deletion in that state, or the row is unreachable
 * for the rest of its life.
 */
export function isJobStateUnsuccessful(state?: string | null): boolean {
	return state === "cancelled" || state === "failed";
}

/**
 * A workflow a job can run.
 *
 * This is the job *read* path and carries every member of Python's `Workflow`
 * enum, `build_index` included. That workflow stays Python-owned — the TypeScript
 * runtime ports the other four — but `build_index` rows exist in the `jobs`
 * table today, so a narrower union would fail to parse a job that is perfectly
 * valid. The jobs API instead refuses to hand out a `build_index` job at
 * claim time, which is a rule about who may run what, not about what a row may
 * contain.
 *
 * Analyses run a strictly narrower set; see `AnalysisWorkflow`.
 */
export const JobWorkflow = z.enum([
	"build_index",
	"create_sample",
	"create_subtraction",
	"nuvs",
	"pathoscope",
]);

export type JobWorkflow = z.infer<typeof JobWorkflow>;

/**
 * A workflow a runner may claim a job for.
 *
 * {@link JobWorkflow} minus `build_index`, and the difference is the whole
 * point: `build_index` rows exist in the `jobs` table and must still parse on
 * the read path, but nothing creates one any more. Python builds indexes
 * through the `create_index` *task* (`virtool/indexes/tasks.py`), not a job, so
 * no runner is waiting on this workflow and handing one out would start a pod
 * that nothing finishes.
 *
 * `POST /jobs/claim` validates its `workflow` query parameter against this, so
 * asking for `build_index` is a `422` rather than a claim that hangs.
 */
export const ClaimableJobWorkflow = z.enum([
	"create_sample",
	"create_subtraction",
	"nuvs",
	"pathoscope",
]);

export type ClaimableJobWorkflow = z.infer<typeof ClaimableJobWorkflow>;

/**
 * A moment on a job wire, as a `Date` on both sides of it.
 *
 * JSON has no date type, so the bytes are an ISO-8601 string either way —
 * `JSON.stringify` calls `Date.prototype.toJSON`, which is `toISOString`, and
 * Python serialises `datetime` to the same shape. The SPA's boundary encodes it
 * with seroval, which revives a `Date` as a `Date`. What this buys is the type:
 * a handler hands the `Date` it read out of Postgres straight to its response,
 * and the caller gets a `Date` back rather than a string every reader would
 * have to remember to parse.
 *
 * `z.coerce.date()` rather than `z.date()`, because the value arriving over the
 * jobs API's wire really is a string; `z.date()` would reject it. It passes a
 * `Date` through unchanged, so the same schema types both directions.
 *
 * The refinement is not decoration. `coerce` runs `new Date(value)`, which
 * answers `Invalid Date` rather than throwing for anything it cannot read — so
 * without it a malformed timestamp parses successfully and surfaces as `NaN`
 * somewhere much later.
 *
 * **This is the wire only.** The `jobs.steps` JSONB array stores `started_at`
 * as a string, because Python reads and writes those same bytes; see
 * {@link StoredJobStep}.
 */
export const JobTimestamp = z.coerce
	.date()
	.refine((value) => !Number.isNaN(value.getTime()), {
		message: "not a readable timestamp",
	});

// # Naming, both halves
//
// **Every field crossing a wire is camelCase** — `runnerId`, `startedAt`,
// `runtimeVersion`. Both ends are code we own and ship together, and it is the
// convention the rest of this package already follows.
//
// **Row content is not the wire, and stays snake_case.** The elements of the
// `jobs.steps` JSONB array carry `started_at` and the stored `claim` blob
// carries `runner_id` / `runtime_version` / `workflow_version`. Python reads
// and writes those same bytes, so they must not be "fixed" into camelCase.
//
// `JobStep` and `JobClaim` therefore exist in two spellings: the wire shapes
// here, and `StoredJobStep` / `StoredJobClaim` below, with mappers between
// them. **A boundary must never publish a JSONB element straight out of the
// column** — that leaks `started_at` onto the wire and is the single most
// likely way this rule gets broken in practice.
//
// They live here rather than in `jobsApi.ts` because they are not one service's
// contract: the jobs API serves them to a workflow runner and the web app
// serves them to the SPA, both reading the same column through the same
// mappers.

/** A workflow step as a boundary publishes it. Persisted as {@link StoredJobStep}. */
export const JobStep = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	startedAt: JobTimestamp.nullable(),
});

export type JobStep = z.infer<typeof JobStep>;

/** A runner's claim metadata as a boundary publishes it. Persisted as {@link StoredJobClaim}. */
export const JobClaim = z.object({
	runnerId: z.string(),
	mem: z.number(),
	cpu: z.number(),
	image: z.string(),
	runtimeVersion: z.string(),
	workflowVersion: z.string(),
});

export type JobClaim = z.infer<typeof JobClaim>;

/**
 * A {@link JobClaim} as it is stored in the `jobs.claim` JSONB column.
 *
 * snake_case, byte-compatible with what Python reads and writes. Never
 * published as-is — map it with {@link fromStoredJobClaim} first.
 */
export const StoredJobClaim = z.object({
	runner_id: z.string(),
	mem: z.number(),
	cpu: z.number(),
	image: z.string(),
	runtime_version: z.string(),
	workflow_version: z.string(),
});

export type StoredJobClaim = z.infer<typeof StoredJobClaim>;

/**
 * A {@link JobStep} as it is stored in the `jobs.steps` JSONB array.
 *
 * snake_case, byte-compatible with what Python reads and writes. Never
 * published as-is — map it with {@link fromStoredJobStep} first.
 */
export const StoredJobStep = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	started_at: z.string().nullable(),
});

export type StoredJobStep = z.infer<typeof StoredJobStep>;

/** Maps a wire claim to the shape written to the `claim` JSONB column. */
export function toStoredJobClaim(claim: JobClaim): StoredJobClaim {
	return {
		runner_id: claim.runnerId,
		mem: claim.mem,
		cpu: claim.cpu,
		image: claim.image,
		runtime_version: claim.runtimeVersion,
		workflow_version: claim.workflowVersion,
	};
}

/** Maps a claim read out of the `claim` JSONB column to its wire shape. */
export function fromStoredJobClaim(stored: StoredJobClaim): JobClaim {
	return {
		runnerId: stored.runner_id,
		mem: stored.mem,
		cpu: stored.cpu,
		image: stored.image,
		runtimeVersion: stored.runtime_version,
		workflowVersion: stored.workflow_version,
	};
}

// These two are where a `Date` becomes column bytes and back. The wire carries
// `Date`; the column carries the ISO string Python wrote. Keeping the
// conversion here means no handler does it by hand, and no handler can forget
// to.

/** Maps a wire step to the shape written to the `steps` JSONB array. */
export function toStoredJobStep(step: JobStep): StoredJobStep {
	return {
		id: step.id,
		name: step.name,
		description: step.description,
		started_at: step.startedAt === null ? null : step.startedAt.toISOString(),
	};
}

/** Maps a step read out of the `steps` JSONB array to its wire shape. */
export function fromStoredJobStep(stored: StoredJobStep): JobStep {
	return {
		id: stored.id,
		name: stored.name,
		description: stored.description,
		startedAt: stored.started_at === null ? null : new Date(stored.started_at),
	};
}

/**
 * How far a job has got, as a percentage.
 *
 * Mirror of Python's `compute_progress`: a terminal job is 100%, a running job
 * is the fraction of its steps that have started, and everything else is 0%.
 *
 * Reads the stored step shape rather than the wire one, because every caller
 * derives this from the `jobs.steps` JSONB column. `state` is a plain `string`
 * and nullable for the same reason {@link isJobStateTerminal} takes one: the
 * column is `text`, and a resource read through a left join has no job at all.
 */
export function computeJobProgress(
	state: string | null,
	steps: StoredJobStep[] | null,
): number {
	if (state !== null && isJobStateTerminal(state)) {
		return 100;
	}

	if (state !== "running" || !steps || steps.length === 0) {
		return 0;
	}

	const started = steps.filter((step) => step.started_at != null).length;

	return Math.floor((started / steps.length) * 100);
}

/** A job embedded in another resource, e.g. a sample's creation job. */
export type JobNested = {
	createdAt: Date;
	id: number;
	progress: number;
	state: JobState;
	user: UserNested;
	workflow: JobWorkflow;
};

/**
 * A job as it appears in a search-result list.
 *
 * Carries exactly {@link JobNested}'s fields today. The two are kept apart
 * because they are different contracts — one is a list row, the other is what a
 * parent resource embeds — and either is free to gain a field the other does
 * not.
 */
export type JobMinimal = {
	createdAt: Date;
	id: number;
	progress: number;
	state: JobState;
	user: UserNested;
	workflow: JobWorkflow;
};

/**
 * A job as a boundary publishes it — the SPA's detail endpoint and the jobs
 * API's lifecycle routes alike.
 *
 * **One shape, not one per audience.** Don't narrow it into a runner-facing
 * half and an SPA-facing half: both would be built from the same record, a
 * field one audience does not read costs it nothing, and zod strips what a
 * schema does not name, so an added field cannot break an older runner.
 *
 * A schema rather than a plain type because the jobs API parses on the way out
 * and the workflow runtime parses on the way in. The SPA parses nothing and
 * imports the inferred type.
 */
export const Job = z.object({
	/**
	 * The workflow's arguments, recomposed from the resources that reference the
	 * job rather than read from a column — `jobs` has no `args`. Every value is
	 * an id, stringified.
	 */
	args: z.record(z.string(), z.string()),

	claim: JobClaim.nullable(),
	claimedAt: JobTimestamp.nullable(),
	createdAt: JobTimestamp,
	finishedAt: JobTimestamp.nullable(),
	id: z.number().int(),
	progress: z.number().int(),
	state: JobState,
	steps: z.array(JobStep).nullable(),
	user: UserNested,
	workflow: JobWorkflow,
});

export type Job = z.infer<typeof Job>;

/**
 * How many jobs sit in each state, across every workflow.
 *
 * Keyed off the whole of {@link JobState} rather than only the states something
 * is queued in, so a filter button reads its count directly and an empty state
 * renders a zero rather than a blank.
 */
export type JobCounts = Record<JobState, number>;

/** A page of jobs, with the per-state totals the filter sidebar reads. */
export type JobSearchResult = SearchResult & {
	counts: JobCounts;
	items: JobMinimal[];
};
