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
	 * to finish. Every type Python also spawns carries Python's interval from
	 * `virtool/startup.py`, so the cadence a deployment sees does not move when
	 * this process replaces that one.
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
 * Every periodic task this process spawns.
 *
 * A type belongs here only once `taskRegistry` carries a handler for it, and a
 * test checks the two against each other. A registration without a handler
 * spawns a row nothing claims: the runner filters its claim on the registry's
 * keys, so the row is never acquired, never fails, and sits queued counting
 * against the queue gauges. The outstanding-work gate holds that at one row per
 * type rather than a backlog, which is what makes the mistake survivable rather
 * than invisible.
 *
 * A test pins this list to exactly these six, so a seventh is a deliberate act.
 *
 * The order is the order each tick walks.
 */
export const PERIODIC_TASKS: PeriodicTaskRegistration[] = [
	{ type: "sweep_blast", intervalSeconds: 30 },
	{ type: "refresh_hmms", intervalSeconds: 600 },
	{ type: "timeout_jobs", intervalSeconds: 600 },
	{ type: "evict_caches_lru", intervalSeconds: 3600 },
	/*
	 * Hourly, and the one interval here Python does not set — `SessionCleanupTask`
	 * was written, never registered, and has since been deleted from that repo, so
	 * expired `sessions` rows have never been deleted in production.
	 *
	 * Correctness never waits on this: `verify.ts` and the reset path in `core.ts`
	 * both reject an expired row on sight, so a row lingering between sweeps is
	 * inert and the sweep is harmless when late. That removes the usual argument
	 * for a short interval. Hourly keeps the shortest-lived rows — 10 minute reset
	 * sessions, 60 minute no-remember ones — from outliving their expiry by much,
	 * without running an indexed scan that finds nothing dozens of times an hour.
	 * Daily is the defensible alternative and is rejected because a day's
	 * accumulation makes each run a larger delete for no benefit.
	 */
	{ type: "cleanup_sessions", intervalSeconds: 3600 },
	{ type: "reap_orphaned_uploads", intervalSeconds: 86_400 },
];
