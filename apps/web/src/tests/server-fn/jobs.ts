import type { ServerJob, ServerJobMinimal } from "@jobs/types";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/jobs/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub
 * the jobs server functions without per-file `vi.mock` boilerplate.
 */
export const jobServerFnMocks = {
	findJobsFn: vi.fn(),
	getJobFn: vi.fn(),
	getJobsFn: vi.fn(),
};

/** Sets up findJobs to resolve with a single page containing the given jobs. */
export function mockFindJobs(
	jobs: ServerJobMinimal[],
	foundCount?: number,
): Mock {
	jobServerFnMocks.findJobsFn.mockResolvedValue({
		counts: {},
		foundCount: foundCount ?? jobs.length,
		items: jobs,
		page: 1,
		pageCount: 1,
		perPage: 25,
		totalCount: jobs.length,
	});
	return jobServerFnMocks.findJobsFn;
}

/**
 * Sets up getJobs to resolve with whichever of the given jobs were asked for.
 *
 * Mirrors the real batch read: ids that match nothing are simply absent from
 * the result rather than an error.
 */
export function mockGetJobs(jobs: ServerJob[]): Mock {
	jobServerFnMocks.getJobsFn.mockImplementation(
		async ({ data }: { data: { jobIds: number[] } }) =>
			jobs.filter((job) => data.jobIds.includes(job.id)),
	);
	return jobServerFnMocks.getJobsFn;
}

/** Sets up getJob to resolve with the given job when matched by id. */
export function mockGetJob(jobId: number, job: ServerJob): Mock {
	jobServerFnMocks.getJobFn.mockImplementation(
		async ({ data }: { data: { jobId: number } }) => {
			if (data.jobId === jobId) {
				return job;
			}
			throw new Error(`unexpected jobId in mockGetJob: ${data.jobId}`);
		},
	);
	return jobServerFnMocks.getJobFn;
}
