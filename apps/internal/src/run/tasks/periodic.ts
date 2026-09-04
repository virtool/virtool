import type { PeriodicTaskName } from "@virtool/contracts";

/** A periodic task type and the minimum seconds between spawns. */
export type PeriodicTaskRegistration = {
	/**
	 * The task type name.
	 *
	 * It is both the advisory-lock key the spawn gate hashes and the `type` a
	 * runner filters its claim on, so it has to match the `type` column exactly.
	 */
	type: PeriodicTaskName;
	/**
	 * Minimum seconds between spawns of this type.
	 *
	 * A suppression window, not a schedule: the loop ticks at
	 * {@link SPAWN_TICK_INTERVAL_MS} regardless, so a type's effective period is
	 * `max(tick, intervalSeconds)` quantised to tick boundaries — and a floor
	 * rather than a period, since a spawn also waits on the last run of the type
	 * to finish.
	 */
	intervalSeconds: number;
};

/**
 * How long the spawn loop waits between ticks.
 *
 * The loop walks every registered task and then sleeps a fixed 30 s, whatever
 * the individual intervals are. One shared tick rather than a timer per type,
 * which makes this the quantum every schedule is measured in: a type's
 * effective period is `max(30 s, intervalSeconds)` quantised to tick
 * boundaries, and no type is considered more often than this however short its
 * interval.
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
 * A test pins this list to exactly these eight, so a ninth is a deliberate
 * act.
 *
 * The order is the order each tick walks.
 */
export const PERIODIC_TASKS: PeriodicTaskRegistration[] = [
	{ type: "sweep_blast", intervalSeconds: 30 },
	/*
	 * The floor, which in practice means every spawn tick. The outbox carries
	 * its own scheduling — `next_attempt_at` and capped backoff — so the task's
	 * cadence only bounds how quickly a freshly enqueued or newly due row is
	 * noticed, and auth emails are exactly the mail people wait on.
	 */
	{ type: "deliver_email", intervalSeconds: 30 },
	{ type: "refresh_hmms", intervalSeconds: 600 },
	{ type: "timeout_jobs", intervalSeconds: 600 },
	{ type: "evict_caches_lru", intervalSeconds: 3600 },
	/*
	 * Hourly. Nothing swept expired `sessions` rows before this registration
	 * existed, so there is no established cadence to hold to and the interval is
	 * chosen on its own merits.
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
	/*
	 * Hourly, for the same reasons `cleanup_sessions` is. Correctness never
	 * waits on it either: `consumeSetupToken` and `verifySetupSession` both
	 * refuse an expired row on sight, so a row lingering between sweeps is
	 * inert. A restricted setup session lives 30 minutes and a setup link 72
	 * hours, so hourly keeps the shorter of the two from outliving its expiry
	 * by much.
	 */
	{ type: "cleanup_setup_state", intervalSeconds: 3600 },
	{ type: "reap_orphaned_uploads", intervalSeconds: 86_400 },
];
