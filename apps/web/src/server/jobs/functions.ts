import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	fromStoredJobClaim,
	fromStoredJobStep,
	type Job,
	type JobCounts,
	type JobMinimal,
	type JobSearchResult,
	JobState,
	JobWorkflow,
} from "@virtool/contracts";
import {
	findJobs,
	getJob,
	getJobs,
	type JobMinimal as JobMinimalRecord,
	JobNotFoundError,
	type Job as JobRecord,
} from "@virtool/data/jobs/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const findJobsSchema = z.object({
	page: z.number().int().min(1).default(1),
	perPage: z.number().int().min(1).max(100).default(25),
	states: z.array(JobState).default([]),
});

const jobIdSchema = z.object({
	jobId: rowIdSchema,
});

// Capped at the same 100 as a `findJobs` page: the batch exists to collapse one
// refetch per on-screen job into one request, and no view shows more than a
// page of them at once.
const jobIdsSchema = z.object({
	jobIds: z.array(rowIdSchema).min(1).max(100),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// JobNotFoundError import it references — from the client bundle. A plain
// top-level helper would pin ./data and its postgres transitive dependency in
// the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof JobNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Job not found.");
	}
	throw err;
});

/**
 * Narrow a row's `workflow` onto the union the SPA reads.
 *
 * `jobs.workflow` is a `text` column carrying no CHECK constraint, so the data
 * layer types it as a plain string. The SPA renders a workflow name as a label
 * and a link and so reads the closed union, and this is the boundary that
 * publishes the wire shape — narrowing here rather than declaring the union on
 * the client is what makes the two disagreeing a type error.
 *
 * A row that does not fit is a **bare throw**, not a `ClientError`: nothing the
 * caller sent is wrong, and this side owns the data. That is a 500 and a Sentry
 * event naming the job, rather than routine control flow the `beforeSend`
 * filter drops.
 *
 * The message carries the id and never the value. It is a Sentry title, and an
 * unbounded one buries the incident among its own variants.
 */
function narrowWorkflow(job: { id: number; workflow: string }): JobWorkflow {
	const parsed = JobWorkflow.safeParse(job.workflow);

	if (!parsed.success) {
		throw new Error(`job ${job.id} names a workflow this build does not know`);
	}

	return parsed.data;
}

/**
 * Map a job row onto the shape the SPA reads.
 *
 * A timestamp crosses as a `Date`: the RPC boundary serialises with seroval,
 * which revives one as a `Date` rather than the string `JSON.stringify` would
 * leave behind, so nothing here or on the client converts. The one column that
 * really does hold a string — `steps[].started_at`, which Python writes — is
 * converted by `fromStoredJobStep`, the same mapper the jobs API uses, so the
 * two boundaries cannot disagree about what that column means.
 */
function toWireJob(record: JobRecord): Job {
	return {
		args: record.args,
		claim: record.claim ? fromStoredJobClaim(record.claim) : null,
		claimedAt: record.claimedAt,
		createdAt: record.createdAt,
		finishedAt: record.finishedAt,
		id: record.id,
		progress: record.progress,
		state: record.state,
		steps: record.steps?.map(fromStoredJobStep) ?? null,
		user: record.user,
		workflow: narrowWorkflow(record),
	};
}

function toWireJobMinimal(record: JobMinimalRecord): JobMinimal {
	return { ...record, workflow: narrowWorkflow(record) };
}

function sumCounts(byWorkflow: Record<string, number>): number {
	return Object.values(byWorkflow).reduce((total, count) => total + count, 0);
}

/**
 * Fold the read's per-state/workflow counts into the per-state totals the
 * filter sidebar reads.
 *
 * The workflow dimension is not published: no view breaks a state's count down
 * by workflow, and folding here rather than in a component is what lets the
 * sidebar read `counts.pending` without a fallback for a key that never arrives.
 */
function toWireJobCounts(
	counts: Record<JobState, Record<string, number>>,
): JobCounts {
	return {
		cancelled: sumCounts(counts.cancelled),
		failed: sumCounts(counts.failed),
		pending: sumCounts(counts.pending),
		running: sumCounts(counts.running),
		succeeded: sumCounts(counts.succeeded),
	};
}

export const findJobsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findJobsSchema)
	.handler(async ({ data }): Promise<JobSearchResult> => {
		const result = await findJobs(db, data);

		return {
			...result,
			counts: toWireJobCounts(result.counts),
			items: result.items.map(toWireJobMinimal),
		};
	});

export const getJobsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(jobIdsSchema)
	.handler(async ({ data }): Promise<Job[]> => {
		const found = await getJobs(db, data.jobIds);

		return found.map(toWireJob);
	});

export const getJobFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(jobIdSchema)
	.handler(async ({ data }): Promise<Job> => {
		try {
			return toWireJob(await getJob(db, data.jobId));
		} catch (err) {
			return await rethrowAsHttp(err);
		}
	});
