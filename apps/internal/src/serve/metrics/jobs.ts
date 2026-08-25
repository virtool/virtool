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
 */
export function createJobQueueReader(
	db: Db,
	options?: MemoizedReaderOptions,
): JobQueueReader {
	return createMemoizedReader(() => readJobQueueBounded(db), options);
}
