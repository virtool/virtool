import type { PeriodicTaskName } from "@virtool/contracts";

/** A periodic task type and the minimum seconds between spawns. */
export type PeriodicTaskRegistration = {
	/**
	 * The task type name.
	 *
	 * Byte-identical to Python's `BaseTask.name`, because it is the
	 * advisory-lock key both spawners hash and the `type` a runner filters on.
	 */
	type: PeriodicTaskName;
	/**
	 * Minimum seconds between spawns of this type.
	 *
	 * A suppression window, not a schedule: the loop ticks at
	 * {@link SPAWN_TICK_INTERVAL_MS} regardless, so a type's effective period is
	 * `max(tick, intervalSeconds)` quantised to tick boundaries — and a floor
	 * rather than a period, since a spawn also waits on the last run of the type
	 * to finish. Must match Python's interval in `virtool/startup.py` while both
	 * spawners run: the shorter of the two sets the effective rate, so a
	 * divergence silently changes production cadence rather than failing.
	 */
	intervalSeconds: number;
};

/**
 * How long the spawn loop waits between ticks.
 *
 * Python's `PeriodicTaskSpawner` walks every registered task and then sleeps a
 * hardcoded 30 s (`virtool/tasks/periodic.py`), whatever the individual
 * intervals are. Matching the tick matters as much as matching the intervals:
 * a per-task timer firing exactly on its interval opens its suppression window
 * at a different moment than Python's tick does, and the two spawners then
 * disagree about when a window is open.
 */
export const SPAWN_TICK_INTERVAL_MS = 30_000;

/**
 * Every periodic task this process spawns, with Python's intervals.
 *
 * **Do not add a type here.** Python's runner is the only runner until the
 * cutover, and it *strands* a task name it does not recognise — it acquires the
 * row, logs a warning and returns, leaving `acquired_at` set, no error and no
 * completion, so the row is counted as running forever and nothing can clear
 * it. New types are registered in the cutover issue, once this process's runner
 * is the one claiming. A test pins this list to exactly these five so a sixth
 * is a deliberate act.
 *
 * The order is the order each tick walks.
 */
export const PERIODIC_TASKS: PeriodicTaskRegistration[] = [
	{ type: "sweep_blast", intervalSeconds: 30 },
	{ type: "refresh_hmms", intervalSeconds: 600 },
	{ type: "timeout_jobs", intervalSeconds: 600 },
	{ type: "evict_caches_lru", intervalSeconds: 3600 },
	{ type: "reap_orphaned_uploads", intervalSeconds: 86_400 },
];
