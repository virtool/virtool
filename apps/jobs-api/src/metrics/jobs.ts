import type { Db } from "@virtool/data/db/pg";
import {
	type JobQueueSnapshot,
	readJobQueueBounded,
} from "@virtool/data/jobs/data";
import {
	createMemoizedReader,
	type MemoizedReaderOptions,
} from "@virtool/data/metrics/memoize";

/** A job-queue read, memoized. */
export type JobQueueReader = () => Promise<JobQueueSnapshot>;

/**
 * Build the memoized job-queue read a `/metrics` scrape calls.
 *
 * `createMemoizedReader` (`@virtool/data/metrics/memoize`) is the shared
 * implementation — every service with a pre-scrape queue read uses it, rather
 * than each declaring its own TTL cache and in-flight-sharing logic. Its
 * default TTL (ten seconds) is well under a typical 15–60s scrape interval,
 * so a scrape still sees a fresh queue; the point of the TTL is the other
 * direction — two Prometheus replicas, or a human curling the endpoint in a
 * loop, would otherwise multiply an unindexed scan across the very pool the
 * jobs API serves workflows from.
 */
export function createJobQueueReader(
	db: Db,
	options?: MemoizedReaderOptions,
): JobQueueReader {
	return createMemoizedReader(() => readJobQueueBounded(db), options);
}
