import type { Db } from "@virtool/data/db/pg";
import {
	type JobQueueSnapshot,
	readJobQueueBounded,
} from "@virtool/data/jobs/data";

/**
 * How long a job-queue read is reused before another scrape re-queries.
 *
 * Well under a typical 15–60s scrape interval, so a scrape still sees a fresh
 * queue. The point is the other direction: two Prometheus replicas, or a human
 * curling the endpoint in a loop, would otherwise multiply an unindexed scan
 * across the very pool the jobs API serves workflows from.
 */
export const JOB_QUEUE_TTL_MS = 10_000;

/** A job-queue read, memoized. */
export type JobQueueReader = () => Promise<JobQueueSnapshot>;

/** Test seams for {@link createJobQueueReader}. */
type JobQueueReaderOptions = {
	ttlMs?: number;
	now?: () => number;
};

/**
 * Build the memoized job-queue read a `/metrics` scrape calls.
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
export function createJobQueueReader(
	db: Db,
	{ ttlMs = JOB_QUEUE_TTL_MS, now = Date.now }: JobQueueReaderOptions = {},
): JobQueueReader {
	let pending: Promise<JobQueueSnapshot> | undefined;
	let cached: { snapshot: JobQueueSnapshot; readAt: number } | undefined;

	return function readJobQueue() {
		if (cached && now() - cached.readAt < ttlMs) {
			return Promise.resolve(cached.snapshot);
		}

		if (!pending) {
			pending = readJobQueueBounded(db)
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
