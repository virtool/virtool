import { z } from "zod";
import type { SearchResult } from "./search";
import type { UserNested } from "./users";

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
 * A job as the SPA's detail endpoint publishes it.
 *
 * `pingedAt` is deliberately absent: a heartbeat is a fact about a runner, and
 * no view shows it. The jobs API publishes its own narrower shape to workflow
 * runners — see `WorkflowJob` — which drops `finishedAt` for the mirror-image
 * reason.
 */
export type Job = {
	/**
	 * The workflow's arguments, recomposed from the resources that reference the
	 * job rather than read from a column. Every value is an id, stringified.
	 */
	args: Record<string, string>;

	claim: JobClaim | null;
	claimedAt: Date | null;
	createdAt: Date;
	finishedAt: Date | null;
	id: number;
	progress: number;
	state: JobState;
	steps: JobStep[] | null;
	user: UserNested;
	workflow: JobWorkflow;
};

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
