import type { Db } from "@virtool/data/db/pg";
import {
	readTaskQueueBounded,
	type TaskQueueSnapshot,
} from "@virtool/data/tasks/data";

/**
 * How long a task-queue read is reused before another scrape re-queries.
 *
 * Well under a typical 15–60 s scrape interval, so a scrape still sees a fresh
 * queue. The point is the other direction: two Prometheus replicas, or a human
 * curling the endpoint in a loop, would otherwise multiply the scan across the
 * very pool this process claims and heartbeats tasks over.
 */
export const TASK_QUEUE_TTL_MS = 10_000;

/** A task-queue read, memoized. */
export type TaskQueueReader = () => Promise<TaskQueueSnapshot>;

/** Test seams for {@link createTaskQueueReader}. */
type TaskQueueReaderOptions = {
	ttlMs?: number;
	now?: () => number;
};

/**
 * Build the memoized task-queue read a `/metrics` scrape calls.
 *
 * A factory rather than module state, so a test gets its own memo and cannot
 * see what another suite left behind — the same rule `createMetrics` follows.
 *
 * In-flight reads are shared, not just settled ones: two scrapes arriving
 * together should cost one query, which a cache keyed only on the last result
 * would not give.
 *
 * A rejection is **not** cached. The read is bounded already, and holding a
 * failure for the full TTL would keep these series dark for ten seconds past a
 * blip that lasted one.
 */
export function createTaskQueueReader(
	db: Db,
	{ ttlMs = TASK_QUEUE_TTL_MS, now = Date.now }: TaskQueueReaderOptions = {},
): TaskQueueReader {
	let pending: Promise<TaskQueueSnapshot> | undefined;
	let cached: { snapshot: TaskQueueSnapshot; readAt: number } | undefined;

	return function readTaskQueue() {
		if (cached && now() - cached.readAt < ttlMs) {
			return Promise.resolve(cached.snapshot);
		}

		if (!pending) {
			pending = readTaskQueueBounded(db)
				.then((snapshot) => {
					cached = { snapshot, readAt: now() };
					return snapshot;
				})
				.finally(() => {
					pending = undefined;
				});
		}

		return pending;
	};
}
