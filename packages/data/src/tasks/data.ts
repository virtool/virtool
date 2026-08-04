import type { Task } from "@virtool/contracts";
import { inArray } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { tasks as tasksTable } from "../db/schema/tasks";
import { AppError } from "../errors";

/** Thrown when a requested task does not exist. */
export class TaskNotFoundError extends AppError {}

/**
 * A task type the TS server can spawn. The runner supports every Python task
 * name, but this union only lists the ones we create from here.
 */
export type TaskType =
	| "clone_reference"
	| "create_index"
	| "import_reference"
	| "install_hmms";

/**
 * Insert a pending task of `type` and return its id.
 *
 * The row is all the Python task runner needs to pick the work up: it polls
 * Postgres for a task with `acquired_at IS NULL`, `complete = false`,
 * `progress = 0`, and a matching `type`, so no further signal is sent from here.
 * `step` mirrors the Python `create`, which seeds it with the task name.
 */
export async function createTask(
	db: DbOrTx,
	type: TaskType,
	context: Record<string, unknown> = {},
): Promise<number> {
	const rows = await db
		.insert(tasksTable)
		.values({
			complete: false,
			context,
			count: 0,
			created_at: new Date(),
			progress: 0,
			step: type,
			type,
		})
		.returning({ id: tasksTable.id });

	return takeFirstOrThrow(rows).id;
}

/**
 * Read the tasks matching `taskIds`.
 *
 * An id with no row is absent from the result rather than an error — the
 * batched read exists to refresh whatever a client is watching, and a task
 * deleted between the frame and the read is not a failure.
 */
export async function getTasks(db: Db, taskIds: number[]): Promise<Task[]> {
	if (taskIds.length === 0) {
		return [];
	}

	const rows = await db
		.select({
			complete: tasksTable.complete,
			created_at: tasksTable.created_at,
			error: tasksTable.error,
			id: tasksTable.id,
			progress: tasksTable.progress,
			step: tasksTable.step,
			type: tasksTable.type,
		})
		.from(tasksTable)
		.where(inArray(tasksTable.id, taskIds));

	return rows.map((row) => ({
		complete: row.complete ?? false,
		created_at: row.created_at,
		error: row.error,
		id: row.id,
		progress: row.progress ?? 0,
		step: row.step ?? "",
		type: row.type,
	}));
}

export async function getTask(db: Db, taskId: number): Promise<Task> {
	const [task] = await getTasks(db, [taskId]);

	if (!task) {
		throw new TaskNotFoundError();
	}

	return task;
}
