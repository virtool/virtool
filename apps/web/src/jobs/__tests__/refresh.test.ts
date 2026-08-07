import { jobQueryKeys } from "@jobs/keys";
import { createJobRefreshQueue } from "@jobs/refresh";
import type { ServerJob } from "@jobs/types";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { jobServerFnMocks, mockGetJobs } from "@tests/server-fn/jobs";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";

const FLUSH_MS = 500;

function createJob(id: number, overrides?: Partial<ServerJob>): ServerJob {
	return {
		args: {},
		id,
		claim: null,
		claimedAt: null,
		createdAt: "2022-12-22T21:37:49.429000Z",
		finishedAt: null,
		progress: 50,
		state: "running",
		steps: null,
		user: { id: 7, handle: "bob" },
		workflow: "pathoscope",
		...overrides,
	};
}

describe("createJobRefreshQueue", () => {
	let queryClient: QueryClient;
	let unsubscribes: (() => void)[];
	let refetches: Map<number, Mock>;

	beforeEach(() => {
		vi.useFakeTimers();
		queryClient = new QueryClient();
		unsubscribes = [];
		refetches = new Map();
	});

	afterEach(() => {
		for (const unsubscribe of unsubscribes) {
			unsubscribe();
		}
		vi.useRealTimers();
	});

	/**
	 * Stand in for a rendered row's `useFetchJob`: seed the detail cache and hold
	 * an active observer on it, pinned fresh the way a seeded call is. The queue
	 * reads only jobs something is actually watching, so `setQueryData` alone
	 * does not make a job on-screen.
	 */
	function watch(...ids: number[]): void {
		for (const id of ids) {
			queryClient.setQueryData(
				jobQueryKeys.detail(id),
				createJob(id, { progress: 0 }),
			);

			const queryFn = vi.fn(async () => createJob(id));
			refetches.set(id, queryFn);

			const observer = new QueryObserver(queryClient, {
				queryKey: jobQueryKeys.detail(id),
				queryFn,
				staleTime: Number.POSITIVE_INFINITY,
			});

			unsubscribes.push(observer.subscribe(() => {}));
		}
	}

	it("collapses a wave of frames into a single batched read", async () => {
		mockGetJobs([createJob(1), createJob(2), createJob(3)]);
		watch(1, 2, 3);

		const queue = createJobRefreshQueue(queryClient);
		queue(1);
		queue(2);
		queue(3);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledExactlyOnceWith({
			data: { jobIds: [1, 2, 3] },
		});
	});

	it("writes each fetched job into its own detail cache", async () => {
		mockGetJobs([
			createJob(1, { progress: 75 }),
			createJob(2, { progress: 90 }),
		]);
		watch(1, 2);

		const queue = createJobRefreshQueue(queryClient);
		queue(1);
		queue(2);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(queryClient.getQueryData(jobQueryKeys.detail(1))).toMatchObject({
			progress: 75,
		});
		expect(queryClient.getQueryData(jobQueryKeys.detail(2))).toMatchObject({
			progress: 90,
		});
	});

	// The jobs list page renders its rows from the list query and mounts no
	// detail queries, so this is what stops a frame per row becoming a read per
	// row there.
	it("does not read a job nothing is watching", async () => {
		mockGetJobs([createJob(1)]);

		const queue = createJobRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(jobServerFnMocks.getJobsFn).not.toHaveBeenCalled();
	});

	// React Query holds a detail's data for the whole gcTime after its row
	// unmounts. Reading those would be a fan-out per wave that the invalidation
	// this replaced never had, since it only ever refetched active queries.
	it("does not read a job whose detail is cached but unmounted", async () => {
		mockGetJobs([createJob(1)]);
		queryClient.setQueryData(jobQueryKeys.detail(1), createJob(1));

		const queue = createJobRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(jobServerFnMocks.getJobsFn).not.toHaveBeenCalled();
	});

	it("marks a cached jobs list stale so its counts and ordering catch up", async () => {
		const listKey = jobQueryKeys.list([1, 25]);
		queryClient.setQueryData(listKey, { items: [] });

		const queue = createJobRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
	});

	it("splits a wave larger than the request cap", async () => {
		const ids = Array.from({ length: 150 }, (_, index) => index + 1);
		mockGetJobs(ids.map((id) => createJob(id)));
		watch(...ids);

		const queue = createJobRefreshQueue(queryClient);
		for (const id of ids) {
			queue(id);
		}

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledTimes(2);
		expect(
			jobServerFnMocks.getJobsFn.mock.calls.map(
				([{ data }]) => data.jobIds.length,
			),
		).toEqual([100, 50]);
	});

	it("falls back to refetching each job when the batch fails", async () => {
		jobServerFnMocks.getJobsFn.mockRejectedValue(new Error("boom"));
		watch(1, 2);

		const queue = createJobRefreshQueue(queryClient);
		queue(1);
		queue(2);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		for (const id of [1, 2]) {
			expect(refetches.get(id)).toHaveBeenCalled();
		}
	});

	// Two batches in flight at once can resolve out of order, and the loser
	// would write a stale snapshot over a newer one — dragging a progress bar
	// backwards, or reviving a finished job.
	it("holds a later wave until the batch in flight resolves", async () => {
		watch(1);

		let resolveFirst: (jobs: ServerJob[]) => void = () => undefined;
		jobServerFnMocks.getJobsFn
			.mockImplementationOnce(
				() =>
					new Promise<ServerJob[]>((resolve) => {
						resolveFirst = resolve;
					}),
			)
			.mockResolvedValueOnce([createJob(1, { progress: 90 })]);

		const queue = createJobRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);
		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledTimes(1);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS * 3);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledTimes(1);

		resolveFirst([createJob(1, { progress: 10 })]);
		await vi.advanceTimersByTimeAsync(0);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledTimes(2);
		expect(queryClient.getQueryData(jobQueryKeys.detail(1))).toMatchObject({
			progress: 90,
		});
	});

	it("opens a new window for frames arriving after a flush", async () => {
		mockGetJobs([createJob(1), createJob(2)]);
		watch(1, 2);

		const queue = createJobRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		queue(2);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledTimes(2);
		expect(jobServerFnMocks.getJobsFn).toHaveBeenNthCalledWith(2, {
			data: { jobIds: [2] },
		});
	});

	it("holds frames arriving inside an open window in the same batch", async () => {
		mockGetJobs([createJob(1), createJob(2)]);
		watch(1, 2);

		const queue = createJobRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS / 2);
		queue(2);
		await vi.advanceTimersByTimeAsync(FLUSH_MS / 2);

		expect(jobServerFnMocks.getJobsFn).toHaveBeenCalledExactlyOnceWith({
			data: { jobIds: [1, 2] },
		});
	});
});
