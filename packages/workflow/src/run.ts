import type { Logger } from "@virtool/logger";
import type { WorkflowContext } from "./context";
import type {
	ResolvedWorkflowStep,
	Workflow,
	WorkflowStepMetadata,
} from "./step";

/** Terminal state of a run. Mirrors Python's `JobState`. */
export type RunState = "succeeded" | "failed" | "cancelled";

/**
 * Cancellation and termination signalling for one run. Replaces Python's
 * `Events`.
 */
export type RunSignals = {
	signal: AbortSignal;
	isCancelled: () => boolean;
	isTerminated: () => boolean;
	/** Ping response reported `cancelled: true`. */
	cancel: () => void;
	/** SIGTERM received. */
	terminate: () => void;
};

/** Options for {@link runWorkflow}. */
export type RunWorkflowOptions<TData, TState> = {
	workflow: Workflow<TData, TState>;
	context: WorkflowContext<TData, TState>;
	signals: RunSignals;
	logger: Logger;
	/**
	 * Reports a step to the jobs API immediately before it runs.
	 *
	 * The only seam the run loop needs into the job lifecycle, and the reason it
	 * is a callback rather than a return value: it fires mid-run, where every
	 * other outcome this function reports is terminal and rides back on
	 * {@link RunOutcome}. A rejection is a failed run — the jobs API not
	 * knowing which step is executing is not something to continue past.
	 */
	onStepStart?: (step: WorkflowStepMetadata) => Promise<void>;
};

/**
 * Outcome of a run. `runWorkflow` reports failure by returning, not by
 * throwing.
 */
export type RunOutcome = { state: RunState; error?: unknown };

/**
 * Create the signalling for one run.
 *
 * Both `cancel` and `terminate` abort the same signal; the flags are what tells
 * the two apart afterwards. A bare abort with neither flag set is the case the
 * run loop warns about, because nothing should be able to produce it.
 */
export function createRunSignals(): RunSignals {
	const controller = new AbortController();

	let cancelled = false;
	let terminated = false;

	return {
		signal: controller.signal,
		isCancelled: () => cancelled,
		isTerminated: () => terminated,
		cancel() {
			cancelled = true;
			controller.abort();
		},
		terminate() {
			terminated = true;
			controller.abort();
		},
	};
}

/** Distinguishes "the signal aborted" from a step that resolved with nothing. */
const ABANDONED = Symbol("abandoned");

function whenAborted(signal: AbortSignal): {
	promise: Promise<typeof ABANDONED>;
	dispose: () => void;
} {
	let dispose = () => {};

	const promise = new Promise<typeof ABANDONED>((resolve) => {
		// An already-aborted signal never emits the event, so a step that aborts
		// the run itself would leave this promise pending forever.
		if (signal.aborted) {
			resolve(ABANDONED);
			return;
		}

		const onAbort = () => resolve(ABANDONED);

		signal.addEventListener("abort", onAbort, { once: true });

		// Removed when the step wins the race. Without it a run leaks one listener
		// per step and trips Node's max-listeners warning on a long workflow.
		dispose = () => signal.removeEventListener("abort", onAbort);
	});

	return { promise, dispose };
}

/**
 * Run one step, giving up on it if the signal aborts first.
 *
 * This is the one real divergence from Python. There, `CancelledError` unwinds
 * the step at its next `await`; aborting an `AbortSignal` in Node interrupts
 * nothing, so the step is raced against the signal and abandoned rather than
 * interrupted. That is safe because the process exits immediately afterwards
 * and the subprocess runner kills its process tree on the same signal.
 *
 * @returns whether the step finished.
 */
async function runStep<TData, TState>(
	step: ResolvedWorkflowStep<TData, TState>,
	context: WorkflowContext<TData, TState>,
	signal: AbortSignal,
	logger: Logger,
): Promise<boolean> {
	const running = step.run(context);
	const aborted = whenAborted(signal);

	try {
		const outcome = await Promise.race([running, aborted.promise]);

		if (outcome !== ABANDONED) {
			return true;
		}
	} catch (error) {
		// A step that forwards `context.signal` to an abort-aware API rejects from
		// that API's own abort listener, which `step.run` registered before this
		// one and which therefore runs first. Classifying that as a step failure
		// would report a cancelled job as failed and hide the cancellation, so an
		// abort outranks whatever the step threw.
		if (!signal.aborted) {
			throw error;
		}

		logger.info(
			{ err: error, stepId: step.id },
			"workflow step rejected on abort",
		);

		return false;
	} finally {
		aborted.dispose();
	}

	// The step is still running and cannot be stopped. Its eventual rejection
	// would otherwise be unhandled and take the process down before the caller
	// has finished reporting the run.
	running.catch((err) => {
		logger.warn(
			{ err, stepId: step.id },
			"abandoned workflow step rejected after the run ended",
		);
	});

	logger.info(
		{ stepId: step.id },
		"abandoning workflow step after cancellation or termination",
	);

	return false;
}

/**
 * Run a workflow's steps and report how it ended.
 *
 * Steps run strictly sequentially. The function **returns** its outcome rather
 * than throwing, and never touches the network, `process.exit`, or signal
 * handlers — the job lifecycle loop owns all of that, driven by the returned
 * {@link RunOutcome} and by `onStepStart`.
 */
export async function runWorkflow<TData, TState>({
	workflow,
	context,
	signals,
	logger,
	onStepStart,
}: RunWorkflowOptions<TData, TState>): Promise<RunOutcome> {
	let aborted = false;
	let failed = false;
	let error: unknown;

	try {
		for (const step of workflow.steps) {
			if (signals.signal.aborted) {
				aborted = true;
				break;
			}

			await onStepStart?.(step);

			logger.info(
				{ stepId: step.id, name: step.name },
				"running workflow step",
			);

			if (!(await runStep(step, context, signals.signal, logger))) {
				aborted = true;
				break;
			}
		}
	} catch (caught) {
		// Tracked separately from `error` because a step is free to throw a falsy
		// value, and `error !== undefined` would then read as a clean run.
		failed = true;
		error = caught;
	}

	if (aborted) {
		if (signals.isCancelled()) {
			logger.info("workflow cancelled");

			return { state: "cancelled" };
		}

		if (!signals.isTerminated()) {
			logger.warn("workflow terminated without sigterm");
		}

		logger.info("workflow terminated");

		return { state: "failed" };
	}

	if (failed) {
		logger.error({ err: error }, "workflow failed");

		return error === undefined
			? { state: "failed" }
			: { state: "failed", error };
	}

	return { state: "succeeded" };
}
