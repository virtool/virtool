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
 *
 * `createMemoizedReader` (`@virtool/data/metrics/memoize`) is the shared
 * implementation — every service with a pre-scrape queue read uses it, rather
 * than each declaring its own TTL cache and in-flight-sharing logic. Its
 * default TTL (ten seconds) is well under a typical 15–60 s scrape interval,
 * so a scrape still sees a fresh queue; the point of the TTL is the other
 * direction — two Prometheus replicas, or a human curling the endpoint in a
 * loop, would otherwise multiply the scan across the very pool this process
 * claims and heartbeats tasks over.
 */
export function createTaskQueueReader(
	db: Db,
	options?: MemoizedReaderOptions,
): TaskQueueReader {
	return createMemoizedReader(() => readTaskQueueBounded(db), options);
}
