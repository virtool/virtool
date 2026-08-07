import { jobQueryKeys } from "@jobs/keys";
import { findJobsFn, getJobFn } from "@server/jobs/functions";
import {
	queryOptions,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { JobState } from "@virtool/contracts";
import {
	JobSchema,
	JobSearchResultSchema,
	type ServerJob,
	type ServerJobNested,
} from "./types";

/**
 * Query options for a page of job search results.
 *
 * @param page - The page to fetch
 * @param perPage - The number of jobs to fetch per page
 * @param states - The states to filter jobs by
 */
export function jobsQueryOptions(
	page: number,
	perPage: number,
	states: JobState[],
) {
	return queryOptions({
		queryKey: jobQueryKeys.list([page, perPage, ...states]),
		queryFn: () => findJobsFn({ data: { page, perPage, states } }),
		select: JobSearchResultSchema.parse,
	});
}

/**
 * Fetch a page of job search results, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the job list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseJobs(
	page: number,
	perPage: number,
	states: JobState[],
) {
	return useSuspenseQuery(jobsQueryOptions(page, perPage, states));
}

/**
 * Expand a nested job into a full server-shaped job for seeding the cache.
 *
 * A nested job carried on a parent resource (sample, index, etc.) lacks the
 * args, claim, and steps that `/jobs/:id` returns. Filling them with empty
 * values lets the nested data seed `jobQueryKeys.detail` so the first paint is
 * instant; the SSE-triggered refetch later replaces it with the full job.
 */
function getJobSeed(job: ServerJobNested): ServerJob {
	return {
		...job,
		args: {},
		claim: null,
		claimedAt: null,
		finishedAt: null,
		steps: null,
	};
}

/**
 * Fetch a job by its id
 *
 * When a nested job is passed as `seed`, it primes the cache for an instant
 * first paint and pins the entry as fresh, so the network is only hit when an
 * SSE `jobs` update invalidates the query.
 *
 * @param jobId - The id of the job to get
 * @param seed - Nested job data to seed the cache with
 * @returns Query results containing the job
 */
export function useFetchJob(jobId: number, seed?: ServerJobNested) {
	return useQuery({
		queryKey: jobQueryKeys.detail(jobId),
		queryFn: () => getJobFn({ data: { jobId } }),
		select: JobSchema.parse,
		enabled: Number.isInteger(jobId),
		initialData: seed ? getJobSeed(seed) : undefined,
		staleTime: seed ? Number.POSITIVE_INFINITY : undefined,
	});
}
