import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	findJobs,
	getJob,
	getJobs,
	JOB_STATES,
	JobNotFoundError,
} from "@virtool/data/jobs/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const jobStateSchema = z.enum(JOB_STATES);

const findJobsSchema = z.object({
	page: z.number().int().min(1).default(1),
	perPage: z.number().int().min(1).max(100).default(25),
	states: z.array(jobStateSchema).default([]),
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

export const findJobsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(findJobsSchema)
	.handler(async ({ data }) => findJobs(db, data));

export const getJobsFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(jobIdsSchema)
	.handler(async ({ data }) => getJobs(db, data.jobIds));

export const getJobFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(jobIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getJob(db, data.jobId);
		} catch (err) {
			await rethrowAsHttp(err);
		}
	});
