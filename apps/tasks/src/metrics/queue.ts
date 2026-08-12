import type { Db } from "@virtool/data/db/pg";
import {
	createMemoizedReader,
	type MemoizedReaderOptions,
} from "@virtool/data/metrics/memoize";
import {
	readTaskQueueBounded,
	type TaskQueueSnapshot,
} from "@virtool/data/tasks/data";

/** A task-queue read, memoized. */
export type TaskQueueReader = () => Promise<TaskQueueSnapshot>;

/**
 * Build the memoized task-queue read a `/metrics` scrape calls.
 */
export function createTaskQueueReader(
	db: Db,
	options?: MemoizedReaderOptions,
): TaskQueueReader {
	return createMemoizedReader(() => readTaskQueueBounded(db), options);
}
