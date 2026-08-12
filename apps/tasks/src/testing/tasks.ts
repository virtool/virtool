import type { Db } from "@virtool/data/db/pg";
import { type TaskRow, tasks } from "@virtool/data/db/schema/tasks";
import { acquireTask, type ClaimedTask } from "@virtool/data/tasks/data";
import { eq } from "drizzle-orm";

/**
 * The runner id a task test claims under.
 *
 * The `ts-` prefix is load-bearing rather than decorative: reclaim and release
 * are scoped to it, so a test claiming under any other prefix exercises a path
 * no runner in the fleet takes.
 */
export const TEST_RUNNER_ID = "ts-runner-a-1";

/**
 * Insert a queued row of `type` and return its id.
 *
 * Rows are written directly rather than through `createTask`, whose `TaskType`
 * lists only the types the web app spawns — a periodic type has no overload
 * there to reach for.
 *
 * Split out of {@link claimTask} for the case that needs the id before the
 * claim, to point a row the task owns back at it.
 */
export async function seedTaskRow(
	db: Db,
	type: string,
	context: Record<string, unknown> = {},
): Promise<number> {
	const [row] = await db
		.insert(tasks)
		.values({
			complete: false,
			context,
			count: 0,
			created_at: new Date(),
			progress: 0,
			step: type,
			type,
		})
		.returning({ id: tasks.id });

	if (row === undefined) {
		throw new Error(`failed to seed a ${type} task`);
	}

	return row.id;
}

/**
 * Claim the waiting task of `type`, or fail the test.
 *
 * A null claim means the row was never seeded, or was seeded in a state the
 * claim query rejects. Both are setup faults, and both are far easier to read
 * here than as a null dereference several assertions later.
 */
export async function acquireOrThrow(
	db: Db,
	type: string,
	runnerId: string = TEST_RUNNER_ID,
): Promise<ClaimedTask> {
	const claimed = await acquireTask(db, { runnerId, allowedTypes: [type] });

	if (claimed === null) {
		throw new Error(`the ${type} task under test was not claimable`);
	}

	return claimed;
}

/** Insert a queued row of `def`'s type and claim it, as the spawner and runner do. */
export async function claimTask(
	db: Db,
	def: { type: string },
	context?: Record<string, unknown>,
): Promise<ClaimedTask> {
	await seedTaskRow(db, def.type, context);

	return acquireOrThrow(db, def.type);
}

/** Read a task row, or fail the test. */
export async function readTaskRow(db: Db, taskId: number): Promise<TaskRow> {
	const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

	if (row === undefined) {
		throw new Error(`no task row with id ${taskId}`);
	}

	return row;
}
