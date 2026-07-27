import { jobQueryKeys } from "@jobs/keys";
import * as Sentry from "@sentry/tanstackstart-react";
import { getJobsFn } from "@server/jobs/functions";
import type { QueryClient } from "@tanstack/react-query";

/**
 * How long to collect job ids before fetching them.
 *
 * A running job emits a frame per step transition, and a page shows one job per
 * row, so frames arrive in waves. Anything long enough to catch a wave collapses
 * it into one request; 500 ms is well under the interval a progress bar is read
 * at.
 */
const FLUSH_MS = 500;

/** Ids per request, matching the cap `getJobsFn` validates. */
const BATCH_SIZE = 100;

function chunk(ids: number[], size: number): number[][] {
	const chunks: number[][] = [];

	for (let i = 0; i < ids.length; i += size) {
		chunks.push(ids.slice(i, i + size));
	}

	return chunks;
}

/**
 * Build a queue that coalesces `jobs` update frames into batched refreshes.
 *
 * Every on-screen job mounts its own `detail(id)` query, so invalidating each
 * frame's detail fires one request per running job per progress wave. The queue
 * collects the ids instead and reads them in a single `getJobsFn` call, writing
 * each result straight into its detail cache.
 *
 * The queue holds its own buffer, so callers get one per `QueryClient`.
 */
export function createJobRefreshQueue(
	queryClient: QueryClient,
): (jobId: number) => void {
	const pending = new Set<number>();
	let windowOpen = false;
	let draining = false;

	async function refreshBatch(jobIds: number[]): Promise<void> {
		try {
			const jobs = await getJobsFn({ data: { jobIds } });

			for (const job of jobs) {
				queryClient.setQueryData(jobQueryKeys.detail(job.id), job);
			}
		} catch (error) {
			Sentry.captureException(error, { tags: { sse: "job-refresh" } });

			// Fall back to the per-job refetch this batch replaced. It costs the
			// fan-out again, but a failed batch leaving every progress bar frozen
			// is worse than a slow window.
			for (const jobId of jobIds) {
				queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(jobId) });
			}
		}
	}

	async function refresh(ids: number[]): Promise<void> {
		// Counts, ordering, and state filters drift as jobs progress, and no
		// amount of detail refetching fixes them. One invalidation per wave
		// covers every mounted jobs list, and is a no-op on the pages — samples,
		// analyses, subtractions — that cache no jobs list at all.
		queryClient.invalidateQueries({ queryKey: jobQueryKeys.lists() });

		// Only a mounted detail has anyone to show the result to. Cached-but-
		// unmounted details would otherwise keep getting read for the whole
		// gcTime after navigating off a job-heavy page — `invalidateQueries`
		// defaults to `refetchType: "active"` and never refetched those, so
		// reading them here would be a fan-out the old path did not have. It is
		// also what keeps the jobs list page, whose rows render from the list
		// query and mount no details, from reading one job per row.
		const cache = queryClient.getQueryCache();
		const watched = ids.filter(
			(id) =>
				cache.find({ queryKey: jobQueryKeys.detail(id), type: "active" }) !==
				undefined,
		);

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
	 * one — dragging a progress bar backwards, or reviving a job that has already
	 * finished. Serializing also means a slow server widens the window on its
	 * own: everything that arrives during a batch coalesces into the next one.
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

	return function queueJobRefresh(jobId: number): void {
		pending.add(jobId);

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
