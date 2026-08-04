import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getTask, TaskNotFoundError } from "@virtool/data/tasks/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";

const taskIdSchema = z.object({
	taskId: rowIdSchema,
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
