import { getTaskFn } from "@server/tasks/functions";
import { useQuery } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { type ServerTask, TaskSchema } from "./types";

/**
 * Fetch a task by its id
 *
 * When a nested task is passed as `seed`, it primes the cache for an instant
 * first paint and pins the entry as fresh, so the network is only hit when an
 * SSE `tasks` update invalidates the query.
 *
 * @param taskId - The id of the task to get
 * @param seed - Nested task data to seed the cache with
 * @returns Query results containing the task
 */
export function useFetchTask(taskId: number, seed?: ServerTask) {
	return useQuery({
		queryKey: taskQueryKeys.detail(taskId),
		queryFn: () => getTaskFn({ data: { taskId } }),
		select: TaskSchema.parse,
		enabled: Number.isInteger(taskId),
		initialData: seed ? TaskSchema.parse(seed) : undefined,
		staleTime: seed ? Number.POSITIVE_INFINITY : undefined,
	});
}
