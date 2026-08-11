import { z } from "zod";

/**
 * A task the spawner inserts on a schedule.
 *
 * These are the five Python's `startup_periodic_tasks` carries, spelled with
 * the `name` of the task class rather than its Python identifier, because the
 * `name` is what lands in `tasks.type`. Their intervals are the spawner's, not
 * this union's.
 *
 * Kept apart from {@link TaskName} because the spawn-outcome counter's label
 * set *is* the schedule: a series for a type nothing ever spawns would sit at
 * zero forever and read as a task that never runs.
 */
export const PeriodicTaskName = z.enum([
	"evict_caches_lru",
	"reap_orphaned_uploads",
	"refresh_hmms",
	"sweep_blast",
	"timeout_jobs",
]);

export type PeriodicTaskName = z.infer<typeof PeriodicTaskName>;

/**
 * Every task name Virtool runs — the five periodic ones plus the four created
 * in response to a request.
 *
 * **This bounds a metric label, not a row.** `tasks.type` is a plain `text`
 * column with no CHECK constraint on either side, so a row may legitimately
 * carry a name this union has never heard of — a typo, or a task a future
 * Python release adds. Anything reading the column keeps it typed `string` and
 * folds an unrecognised value onto `other` at the point it becomes a label.
 */
export const TaskName = z.enum([
	...PeriodicTaskName.options,
	"clone_reference",
	"create_index",
	"import_reference",
	"install_hmms",
]);

export type TaskName = z.infer<typeof TaskName>;

/**
 * A background task's live progress and metadata, as it is embedded in the
 * resources a task acts on.
 */
export type Task = {
	complete: boolean;
	createdAt: Date;
	error: string | null;
	id: number;
	progress: number;
	step: string;
	type: string;
};
