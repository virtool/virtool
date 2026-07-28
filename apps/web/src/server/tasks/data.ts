import type { Task } from "@virtool/contracts";
import { eq } from "drizzle-orm";
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

export async function getTask(db: Db, taskId: number): Promise<Task> {
	const [row] = await db
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
		.where(eq(tasksTable.id, taskId));

	if (!row) {
		throw new TaskNotFoundError();
	}

	return {
		complete: row.complete ?? false,
		created_at: row.created_at,
		error: row.error,
		id: row.id,
		progress: row.progress ?? 0,
		step: row.step ?? "",
		type: row.type,
	};
}
