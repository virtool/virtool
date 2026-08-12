import { z } from "zod";

/**
 * A task the spawner inserts on a schedule.
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
 * Every task name Virtool runs — the five periodic ones, the four created in
 * response to a request, and `cleanup_sessions`.
 */
export const TaskName = z.enum([
	...PeriodicTaskName.options,
	"cleanup_sessions",
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
