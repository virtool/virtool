import type { Task } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/tasks/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub
 * the tasks server functions without per-file `vi.mock` boilerplate.
 */
export const taskServerFnMocks = {
	getTaskFn: vi.fn(),
	getTasksFn: vi.fn(),
};

/**
 * Sets up getTasks to resolve with whichever of the given tasks were asked for.
 *
 * Mirrors the real batch read: ids that match nothing are simply absent from
 * the result rather than an error.
 */
export function mockGetTasks(tasks: Task[]): Mock {
	taskServerFnMocks.getTasksFn.mockImplementation(
		async ({ data }: { data: { taskIds: number[] } }) =>
			tasks.filter((task) => data.taskIds.includes(task.id)),
	);
	return taskServerFnMocks.getTasksFn;
}
