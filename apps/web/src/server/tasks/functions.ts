import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getTask, getTasks, TaskNotFoundError } from "@virtool/data/tasks/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const taskIdSchema = z.object({
	taskId: rowIdSchema,
});

// Capped at 100, matching `getJobsFn`: the batch exists to collapse one refetch
// per on-screen task into one request, and no view shows more than a page of
// task-bearing rows at once.
const taskIdsSchema = z.object({
	taskIds: z.array(rowIdSchema).min(1).max(100),
});

// Wrapped in createServerOnlyFn so the compiler can strip this body — and the
// TaskNotFoundError import it references — from the client bundle. A plain
// top-level helper would pin ./data and its postgres transitive dependency in
// the client graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof TaskNotFoundError) {
		setResponseStatus(404);
		throw new ClientError("Task not found.");
	}
	throw err;
});

export const getTasksFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(taskIdsSchema)
	.handler(async ({ data }) => getTasks(db, data.taskIds));

export const getTaskFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(taskIdSchema)
	.handler(async ({ data }) => {
		try {
			return await getTask(db, data.taskId);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});
