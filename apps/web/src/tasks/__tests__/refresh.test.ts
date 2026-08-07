import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { createTaskRefreshQueue } from "@tasks/refresh";
import type { ServerTask } from "@tasks/types";
import { mockGetTasks, taskServerFnMocks } from "@tests/server-fn/tasks";
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

function createTask(id: number, overrides?: Partial<ServerTask>): ServerTask {
	return {
		complete: false,
		createdAt: "2022-12-22T21:37:49.429000Z",
		error: null,
		id,
		progress: 50,
		step: "download",
		type: "clone_reference",
		...overrides,
	};
}

describe("createTaskRefreshQueue", () => {
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
	 * Stand in for a rendered row's `useFetchTask`: seed the detail cache and hold
	 * an active observer on it, pinned fresh the way a seeded call is. The queue
	 * reads only tasks something is actually watching, so `setQueryData` alone
	 * does not make a task on-screen.
	 */
	function watch(...ids: number[]): void {
		for (const id of ids) {
			queryClient.setQueryData(
				taskQueryKeys.detail(id),
				createTask(id, { progress: 0 }),
			);

			const queryFn = vi.fn(async () => createTask(id));
			refetches.set(id, queryFn);

			const observer = new QueryObserver(queryClient, {
				queryKey: taskQueryKeys.detail(id),
				queryFn,
				staleTime: Number.POSITIVE_INFINITY,
			});

			unsubscribes.push(observer.subscribe(() => {}));
		}
	}

	it("collapses a wave of frames into a single batched read", async () => {
		mockGetTasks([createTask(1), createTask(2), createTask(3)]);
		watch(1, 2, 3);

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);
		queue(2);
		queue(3);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledExactlyOnceWith({
			data: { taskIds: [1, 2, 3] },
		});
	});

	it("writes each fetched task into its own detail cache", async () => {
		mockGetTasks([
			createTask(1, { progress: 75 }),
			createTask(2, { progress: 90 }),
		]);
		watch(1, 2);

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);
		queue(2);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(queryClient.getQueryData(taskQueryKeys.detail(1))).toMatchObject({
			progress: 75,
		});
		expect(queryClient.getQueryData(taskQueryKeys.detail(2))).toMatchObject({
			progress: 90,
		});
	});

	// A resource whose row renders no progress — an archived reference, a
	// completed install — mounts no task detail, so its frames cost nothing.
	it("does not read a task nothing is watching", async () => {
		mockGetTasks([createTask(1)]);

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(taskServerFnMocks.getTasksFn).not.toHaveBeenCalled();
	});

	// React Query holds a detail's data for the whole gcTime after its row
	// unmounts. Reading those would be a fan-out per wave that the invalidation
	// this replaced never had, since it only ever refetched active queries.
	it("does not read a task whose detail is cached but unmounted", async () => {
		mockGetTasks([createTask(1)]);
		queryClient.setQueryData(taskQueryKeys.detail(1), createTask(1));

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(taskServerFnMocks.getTasksFn).not.toHaveBeenCalled();
	});

	// `useFetchTask` pins a seeded entry with `staleTime: Infinity`, so without
	// this the remount would render the last in-progress step for the whole
	// gcTime rather than refetching a task that finished while the page was away.
	it("marks a cached but unmounted detail stale so its remount refetches", async () => {
		queryClient.setQueryData(taskQueryKeys.detail(1), createTask(1));

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(
			queryClient.getQueryState(taskQueryKeys.detail(1))?.isInvalidated,
		).toBe(true);
	});

	it("splits a wave larger than the request cap", async () => {
		const ids = Array.from({ length: 150 }, (_, index) => index + 1);
		mockGetTasks(ids.map((id) => createTask(id)));
		watch(...ids);

		const queue = createTaskRefreshQueue(queryClient);
		for (const id of ids) {
			queue(id);
		}

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledTimes(2);
		expect(
			taskServerFnMocks.getTasksFn.mock.calls.map(
				([{ data }]) => data.taskIds.length,
			),
		).toEqual([100, 50]);
	});

	it("falls back to refetching each task when the batch fails", async () => {
		taskServerFnMocks.getTasksFn.mockRejectedValue(new Error("boom"));
		watch(1, 2);

		const queue = createTaskRefreshQueue(queryClient);
		queue(1);
		queue(2);

		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		for (const id of [1, 2]) {
			expect(refetches.get(id)).toHaveBeenCalled();
		}
	});

	// Two batches in flight at once can resolve out of order, and the loser
	// would write a stale snapshot over a newer one — dragging a progress bar
	// backwards, or reviving a finished task.
	it("holds a later wave until the batch in flight resolves", async () => {
		watch(1);

		let resolveFirst: (tasks: ServerTask[]) => void = () => undefined;
		taskServerFnMocks.getTasksFn
			.mockImplementationOnce(
				() =>
					new Promise<ServerTask[]>((resolve) => {
						resolveFirst = resolve;
					}),
			)
			.mockResolvedValueOnce([createTask(1, { progress: 90 })]);

		const queue = createTaskRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);
		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledTimes(1);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS * 3);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledTimes(1);

		resolveFirst([createTask(1, { progress: 10 })]);
		await vi.advanceTimersByTimeAsync(0);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledTimes(2);
		expect(queryClient.getQueryData(taskQueryKeys.detail(1))).toMatchObject({
			progress: 90,
		});
	});

	it("opens a new window for frames arriving after a flush", async () => {
		mockGetTasks([createTask(1), createTask(2)]);
		watch(1, 2);

		const queue = createTaskRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		queue(2);
		await vi.advanceTimersByTimeAsync(FLUSH_MS);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledTimes(2);
		expect(taskServerFnMocks.getTasksFn).toHaveBeenNthCalledWith(2, {
			data: { taskIds: [2] },
		});
	});

	it("holds frames arriving inside an open window in the same batch", async () => {
		mockGetTasks([createTask(1), createTask(2)]);
		watch(1, 2);

		const queue = createTaskRefreshQueue(queryClient);

		queue(1);
		await vi.advanceTimersByTimeAsync(FLUSH_MS / 2);
		queue(2);
		await vi.advanceTimersByTimeAsync(FLUSH_MS / 2);

		expect(taskServerFnMocks.getTasksFn).toHaveBeenCalledExactlyOnceWith({
			data: { taskIds: [1, 2] },
		});
	});
});
