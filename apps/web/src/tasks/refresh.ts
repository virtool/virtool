import * as Sentry from "@sentry/tanstackstart-react";
import { getTasksFn } from "@server/tasks/functions";
import type { QueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";

/**
 * How long to collect task ids before fetching them.
 *
 * A running task emits a frame per progress step — a reference clone reports
 * over a hundred — and each frame reaches every connected browser. Anything
 * long enough to catch a wave collapses it into one request; 500 ms is well
 * under the interval a progress bar is read at.
 */
const FLUSH_MS = 500;

/** Ids per request, matching the cap `getTasksFn` validates. */
const BATCH_SIZE = 100;

function chunk(ids: number[], size: number): number[][] {
	const chunks: number[][] = [];

	for (let i = 0; i < ids.length; i += size) {
		chunks.push(ids.slice(i, i + size));
	}

	return chunks;
}

/**
 * Build a queue that coalesces `tasks` update frames into batched refreshes.
 *
 * Every task-bearing row on screen mounts its own `detail(id)` query, so
 * invalidating each frame's detail fires one `getTaskFn` request per row per
 * progress step. The queue collects the ids instead and reads them in a single
 * `getTasksFn` call, writing each result straight into its detail cache.
 *
 * Unlike jobs, there is no `lists()` invalidation: nothing caches a task
 * collection, so there are no counts or ordering to drift.
 *
 * The queue holds its own buffer, so callers get one per `QueryClient`.
 */
export function createTaskRefreshQueue(
	queryClient: QueryClient,
): (taskId: number) => void {
	const pending = new Set<number>();
	let windowOpen = false;
	let draining = false;

	async function refreshBatch(taskIds: number[]): Promise<void> {
		try {
			const tasks = await getTasksFn({ data: { taskIds } });

			for (const task of tasks) {
				queryClient.setQueryData(taskQueryKeys.detail(task.id), task);
			}
		} catch (error) {
			Sentry.captureException(error, { tags: { sse: "task-refresh" } });

			// Fall back to the per-task refetch this batch replaced. It costs the
			// fan-out again, but a failed batch leaving every progress bar frozen
			// is worse than a slow window.
			for (const taskId of taskIds) {
				queryClient.invalidateQueries({
					queryKey: taskQueryKeys.detail(taskId),
				});
			}
		}
	}

	async function refresh(ids: number[]): Promise<void> {
		// Only a mounted detail has anyone to show the result to. Cached-but-
		// unmounted details would otherwise keep getting read for the whole
		// gcTime after navigating off a task-bearing page — `invalidateQueries`
		// defaults to `refetchType: "active"` and never refetched those, so
		// reading them here would be a fan-out the old path did not have.
		const cache = queryClient.getQueryCache();
		const watched: number[] = [];

		for (const id of ids) {
			const queryKey = taskQueryKeys.detail(id);

			if (cache.find({ queryKey, type: "active" })) {
				watched.push(id);
				continue;
			}

			// Dropping the id is not the same as ignoring the frame. `useFetchTask`
			// pins a seeded entry with `staleTime: Infinity`, and a remount reads
			// the cached entry rather than the fresher seed its parent now holds —
			// so a task that finished while the page was away would render its last
			// in-progress step until gcTime elapsed. Marking it invalidated is what
			// the per-frame invalidation this replaced did, and `isInvalidated`
			// outranks `staleTime`, so the remount refetches. `refetchType: "none"`
			// keeps that from becoming the fan-out the filter exists to avoid.
			queryClient.invalidateQueries({ queryKey, refetchType: "none" });
		}

		if (watched.length === 0) {
			return;
		}

		await Promise.all(chunk(watched, BATCH_SIZE).map(refreshBatch));
	}

	/**
	 * Run waves one at a time until the buffer is empty.
	 *
	 * Batches must not overlap. Two in flight at once can resolve out of order,
	 * and the loser's `setQueryData` would write a stale snapshot over a newer
	 * one — dragging a progress bar backwards, or reviving a task that has
	 * already finished. Serializing also means a slow server widens the window on
	 * its own: everything that arrives during a batch coalesces into the next one.
	 */
	async function drain(): Promise<void> {
		draining = true;

		try {
			while (pending.size > 0) {
				const ids = [...pending];
				pending.clear();

				await refresh(ids);
			}
		} finally {
			draining = false;
		}
	}

	return function queueTaskRefresh(taskId: number): void {
		pending.add(taskId);

		// A drain in flight takes these ids on its next pass, and an open window
		// will take them when it elapses. The window is never cancelled, only
		// allowed to elapse, so its timer handle is not worth keeping.
		if (windowOpen || draining) {
			return;
		}

		windowOpen = true;

		setTimeout(() => {
			windowOpen = false;
			void drain();
		}, FLUSH_MS);
	};
}
