import type { Job, JobCounts, JobMinimal } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * The counts a page with nothing queued carries.
 *
 * `findJobsFn` folds its per-state/workflow read into totals before publishing,
 * so every state is always a key — a mock that omitted them would let a
 * component get away with a fallback the real response never needs.
 */
const NO_JOB_COUNTS: JobCounts = {
	cancelled: 0,
	failed: 0,
	pending: 0,
	running: 0,
	succeeded: 0,
};

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
export function mockFindJobs(jobs: JobMinimal[], foundCount?: number): Mock {
	jobServerFnMocks.findJobsFn.mockResolvedValue({
		counts: NO_JOB_COUNTS,
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
export function mockGetJobs(jobs: Job[]): Mock {
	jobServerFnMocks.getJobsFn.mockImplementation(
		async ({ data }: { data: { jobIds: number[] } }) =>
			jobs.filter((job) => data.jobIds.includes(job.id)),
	);
	return jobServerFnMocks.getJobsFn;
}

/** Sets up getJob to resolve with the given job when matched by id. */
export function mockGetJob(jobId: number, job: Job): Mock {
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
