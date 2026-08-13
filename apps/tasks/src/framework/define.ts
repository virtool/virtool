/**
 * The authoring surface every task body is written against.
 *
 * A task body declares its type, the shape of its payload, and the sequence of
 * steps it moves through. It reports progress through the reporter `runStep`
 * hands it, and it never touches the `tasks` table, never emits a frame and
 * never learns which runner is executing it. Persistence stays in
 * `@virtool/data`; this module is the shell that calls it.
 *
 * **A `run` may execute more than once for the same `taskId`. Make every step
 * idempotent.** A claim is a lease, and a lease that expires is reclaimed by
 * another runner — which starts the body again from step zero, with whatever
 * partial work the previous attempt left behind still in place. Nothing here
 * records which steps already ran; the claim query deliberately dropped
 * Python's `progress = 0` filter, because it excluded exactly the rows a
 * reclaim exists for. A body that cannot tolerate re-entry must key its own
 * idempotency off `taskId`.
 */

import type { Logger } from "@virtool/logger";
import type { z } from "zod";

/**
 * Report progress within the current step, as a fraction from 0 to 1.
 *
 * Returns nothing: writes are coalesced on a debounce window, so there is no
 * per-call round trip to wait on. Values outside `[0, 1]` are clamped, and a
 * value below one already reported is ignored rather than written.
 */
export type StepProgressReporter = (frac: number) => void;

/** Helpers exposed to a task handler at run time. */
export type TaskHelpers = {
	/**
	 * Run a named step. Sets the row's `step` column and scales `progress` so
	 * each declared step occupies an equal slice of 0–100. Call `report(0..1)`
	 * from inside to move progress within that slice.
	 *
	 * A task that declares no `steps` maps each step it runs onto the whole
	 * 0–100 bar. A task that declares them and then runs a name absent from the
	 * list still sets the column, but its reports are dropped and logged: the
	 * name is a typo, and giving it the whole bar would pin progress at 100 for
	 * the rest of the run.
	 */
	runStep: <T>(
		name: string,
		fn: (report: StepProgressReporter) => Promise<T>,
	) => Promise<T>;
};

/** Arguments passed to a task handler. */
export type TaskHandlerArgs<P, C> = {
	taskId: number;
	payload: P;
	signal: AbortSignal;
	helpers: TaskHelpers;
	ctx: C;
	logger: Logger;
};

/**
 * Why a task's `cleanup` was called.
 *
 * `failed` is a task that is over: the row is about to carry an error and
 * nothing will run it again. `aborted` is a task that is going to run again —
 * the pod is draining, the claim is about to be released, and another runner
 * picks the row up from step zero.
 *
 * The distinction has to be handed down rather than read off `signal.aborted`
 * inside the handler. `runTask` samples the signal *before* the progress flush
 * and the lease renewal that precede a cleanup, and acts on the value it
 * sampled; an abort landing inside that window leaves the two disagreeing, so a
 * body reading the live signal can skip its teardown on a run that is
 * nevertheless recorded as failed.
 */
export type TaskCleanupReason = "aborted" | "failed";

/** Arguments passed to a task's `cleanup`. */
export type TaskCleanupArgs<P, C> = TaskHandlerArgs<P, C> & {
	reason: TaskCleanupReason;
};

/**
 * A task type, as its author writes it. Construct with {@link defineTask}.
 *
 * `S` is the payload schema, so `run` and `cleanup` receive a payload already
 * narrowed to what it parses. `C` is the context the runner injects; leave it
 * off when a body does not read `ctx`.
 */
export type TaskDef<S extends z.ZodType, C = unknown> = {
	/** Matches the `type` column, and the name Python's runner knows. */
	type: string;
	/** Parsed against the row's `context` before any handler code runs. */
	payload: S;
	/** Sequential step names. Each occupies an equal slice of 0–100 progress. */
	steps?: readonly string[];
	/**
	 * Runs on any non-success terminal outcome — thrown or aborted. Never on
	 * success, and never once another runner has reclaimed the task.
	 *
	 * `reason` says which of the two it was, and a body tearing down anything a
	 * re-run depends on **must** branch on it: an `aborted` task is going to be
	 * released and claimed again, so teardown there destroys the state its own
	 * next attempt reads. `install_hmms` is the worked example.
	 *
	 * A throwing `cleanup` is caught and logged; it does not mask the failure
	 * that provoked it or change the error recorded on the row.
	 */
	cleanup?: (args: TaskCleanupArgs<z.infer<S>, C>) => Promise<void>;
	/**
	 * The body.
	 *
	 * **May execute more than once for the same `taskId`** — see this module's
	 * documentation. Make every step idempotent.
	 */
	run: (args: TaskHandlerArgs<z.infer<S>, C>) => Promise<void>;
};

/**
 * A task with its payload type erased, as a registry holds it.
 *
 * A registry maps names to tasks whose payloads have nothing in common, so the
 * type it stores cannot name any one of them. {@link defineTask} performs the
 * erasure once, which is what keeps the cast out of every task body and out of
 * the runner.
 */
export type RegisteredTask<C = unknown> = TaskDef<z.ZodType, C>;

/** Every task type a runner will dispatch, keyed by its `type` column value. */
export type TaskRegistry<C = unknown> = Record<string, RegisteredTask<C>>;

/**
 * Register a task type.
 *
 * Identity at run time — it exists for the inference, giving `run` and
 * `cleanup` a payload narrowed by `payload` without either being annotated,
 * and for the payload erasure that lets one registry hold every task.
 *
 * The erasure is sound because the only caller of `run` parses `payload`
 * first and passes what it produced: `runTask` never hands a body a value
 * the body's own schema has not accepted.
 */
export function defineTask<S extends z.ZodType, C = unknown>(
	def: TaskDef<S, C>,
): RegisteredTask<C> {
	return def as RegisteredTask<C>;
}
