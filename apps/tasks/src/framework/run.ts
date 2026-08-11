import type { Db } from "@virtool/data/db/pg";
import {
	type ClaimedTask,
	completeTask,
	failTask,
	renewLeases,
} from "@virtool/data/tasks/data";
import type { Logger } from "@virtool/logger";
import type {
	RegisteredTask,
	StepProgressReporter,
	TaskHandlerArgs,
	TaskHelpers,
} from "./define";
import {
	createProgressWriter,
	type ProgressWriter,
	roundHalfToEven,
} from "./progress";

/**
 * How a run ended.
 *
 * `fenced` is not a failure of this runner's: the lease expired, another runner
 * has the task and is running it again from step zero. Nothing further may be
 * written or emitted for it. `aborted` is a shutdown — the row is left exactly
 * as it stands, for the caller to release — and is also what a terminal write
 * the database refused reports, since that leaves the row in the same state.
 */
export type TaskOutcome =
	| { status: "completed" }
	| { status: "failed"; error: string }
	| { status: "aborted" }
	| { status: "fenced" };

/** What {@link runTask} needs to dispatch one claimed task. */
export type RunTaskOptions<C> = {
	db: Db;
	def: RegisteredTask<C>;
	task: ClaimedTask;
	ctx: C;
	logger: Logger;
	signal: AbortSignal;
	/** Overrides the progress debounce window. For tests. */
	debounceMs?: number;
};

/**
 * Render an error for the `error` column.
 *
 * Python writes `f"{type(e)}: {e!s}"`, which puts `"<class 'ValueError'>: boom"`
 * in front of a user. The name alone is what anyone reading the task list
 * actually wants.
 */
function describeError(err: unknown): string {
	return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Build the `runStep` a handler scales its progress through. */
function createHelpers(
	steps: readonly string[],
	writer: ProgressWriter,
	logger: Logger,
): TaskHelpers {
	async function runStep<T>(
		name: string,
		fn: (report: StepProgressReporter) => Promise<T>,
	): Promise<T> {
		const index = steps.indexOf(name);
		const declared = index !== -1;

		// A task that declares no steps maps every step it runs onto the whole bar.
		// A task that declares them and then runs a name absent from the list has a
		// typo, and its reports are dropped rather than given that whole range:
		// taking 0–100 for one step would drive the bar to 100 and, by the
		// monotonic rule, silence every declared step that came after it.
		const unknown = !declared && steps.length > 0;

		if (unknown) {
			logger.warn(
				{ step: name, steps },
				"dropped the progress of a step the task does not declare",
			);
		}

		const sliceStart = declared ? (100 * index) / steps.length : 0;
		const sliceEnd = declared ? (100 * (index + 1)) / steps.length : 100;

		// The step name and the basis are written before the body runs, matching
		// Python, and immediately rather than on the debounce: entering a step is
		// the transition a watching user notices. There is no matching write on the
		// way out — the next step's entry carries the same value, and the last
		// step's end is what the completion writes. One that fired regardless of
		// how the step ended would report a step that threw as finished.
		await writer.setNow({
			step: name,
			...(declared && { progress: roundHalfToEven(sliceStart) }),
		});

		function report(frac: number): void {
			if (unknown) {
				return;
			}

			const clamped = Math.min(Math.max(frac, 0), 1);

			writer.set({
				progress: roundHalfToEven(
					sliceStart + clamped * (sliceEnd - sliceStart),
				),
			});
		}

		return await fn(report);
	}

	return { runStep };
}

/** The `task_id` and `type` every log record from a run carries. */
type TaskFields = { task_id: number; type: string };

/**
 * Perform a terminal write and map it onto an outcome.
 *
 * A write that matches nothing is a fence — the lease expired and another
 * runner owns the task. A write that *rejects* is neither: the row still
 * carries this runner's claim and is not complete, so the outcome is `aborted`
 * and the caller releases it for another runner to redo, which every body is
 * required to be idempotent for. Letting the rejection escape instead would
 * break the promise that a run always reports how it ended, and would leave the
 * claim standing until its lease ran out.
 */
async function recordTerminal(
	write: () => Promise<boolean>,
	outcome: TaskOutcome,
	logger: Logger,
	fields: TaskFields,
): Promise<TaskOutcome> {
	try {
		return (await write()) ? outcome : { status: "fenced" };
	} catch (err) {
		logger.error(
			{ err, ...fields },
			"failed to record a task's terminal state",
		);

		return { status: "aborted" };
	}
}

/** Run `def.cleanup`, swallowing anything it throws. */
async function runCleanup<C>(
	def: RegisteredTask<C>,
	args: TaskHandlerArgs<unknown, C>,
	logger: Logger,
): Promise<void> {
	if (def.cleanup === undefined) {
		return;
	}

	try {
		await def.cleanup(args);
	} catch (err) {
		// Never rethrown: the failure that provoked the cleanup is the one worth
		// recording, and losing it to a secondary error in the handler that was
		// meant to tidy up after it is how the original cause disappears.
		logger.error(
			{ err, task_id: args.taskId, type: def.type },
			"task cleanup failed",
		);
	}
}

/**
 * Dispatch one claimed task and report how it ended.
 *
 * The whole terminal contract lives here. A handler that returns while the
 * signal is clear completes the task; one that throws fails it, with
 * `${err.name}: ${err.message}` on the row. A payload the schema rejects fails
 * it before any handler code runs. Progress is flushed before either terminal
 * write, so a bar can never be stranded at the value a pending debounce was
 * holding.
 *
 * `cleanup` runs on every outcome but success — including the one that is easy
 * to miss, where a handler notices `signal.aborted` and returns *cleanly*. That
 * path looks exactly like success to a naive `catch`-only implementation, and
 * skips the cleanup silently.
 *
 * It runs nothing after a fence. A lease that expired means another runner owns
 * the task and is re-running it, and a cleanup here would be tearing down the
 * new owner's work — so the claim is renewed and checked before the cleanup
 * rather than inferred from whatever write happened to be outstanding.
 *
 * This function does not release, retry or reschedule. It writes progress and a
 * terminal status, and returns — what to do with an `aborted` or `fenced`
 * outcome is the runner's.
 */
export async function runTask<C>(
	options: RunTaskOptions<C>,
): Promise<TaskOutcome> {
	const { ctx, db, def, logger, signal, task } = options;

	const fields: TaskFields = { task_id: task.id, type: def.type };

	if (signal.aborted) {
		// The claim and this dispatch are not one operation, so a SIGTERM can land
		// between them. A body started here would run a whole step through the
		// drain and be killed mid-write with nothing recorded.
		return { status: "aborted" };
	}

	const writer = createProgressWriter({
		db,
		taskId: task.id,
		runnerId: task.runnerId,
		logger,
		progress: task.progress,
		...(options.debounceMs !== undefined && { debounceMs: options.debounceMs }),
	});

	const parsed = def.payload.safeParse(task.context);

	if (!parsed.success) {
		const message = `Invalid payload: ${parsed.error.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ")}`;

		logger.error(
			{ ...fields, message },
			"task payload did not match its schema",
		);

		return recordTerminal(
			() => failTask(db, task.id, task.runnerId, message),
			{ status: "failed", error: message },
			logger,
			fields,
		);
	}

	const args: TaskHandlerArgs<unknown, C> = {
		ctx,
		helpers: createHelpers(def.steps ?? [], writer, logger),
		logger,
		payload: parsed.data,
		signal,
		taskId: task.id,
	};

	let failure: unknown;
	let threw = false;

	try {
		await def.run(args);
	} catch (err) {
		failure = err;
		threw = true;
	}

	// Sampled before the flush, which is a round trip. An abort arriving inside it
	// would otherwise turn a run that finished into an abort, tearing down work
	// that succeeded and leaving the task to be done again.
	const aborted = signal.aborted;

	await writer.flush();

	if (writer.isFenced()) {
		logger.warn(fields, "abandoned a task reclaimed by another runner");

		return { status: "fenced" };
	}

	if (!threw && !aborted) {
		return recordTerminal(
			() => completeTask(db, task.id, task.runnerId),
			{ status: "completed" },
			logger,
			fields,
		);
	}

	// The writer's fence flag only flips when a progress write happened to be
	// outstanding, so a body that reported nothing since its last flush arrives
	// here still believing it holds the task. Renewing the lease answers that
	// directly, and holds the claim for however long the cleanup takes.
	let held: boolean;

	try {
		held = (await renewLeases(db, [task.id], task.runnerId)).length > 0;
	} catch (err) {
		// A claim that cannot be vouched for does not get a cleanup: tearing down a
		// task another runner has taken over is worse than leaving a half-built one
		// behind. The row still carries this claim, so the caller releases it.
		logger.error(
			{ err, ...fields },
			"could not confirm this runner still holds the task",
		);

		return { status: "aborted" };
	}

	if (!held) {
		logger.warn(fields, "abandoned a task reclaimed by another runner");

		return { status: "fenced" };
	}

	await runCleanup(def, args, logger);

	// A cleanup reports progress like any other step, and the debounce timer is
	// `.unref()`'d — without this its write lands after the terminal one, where it
	// matches nothing and reports a fence that never happened.
	await writer.flush();

	if (aborted) {
		// Abort wins over a throw. A body interrupted mid-shutdown usually throws
		// on its way out, and recording that as a permanent failure would burn a
		// task whose only problem was the pod going away.
		if (threw) {
			logger.debug({ err: failure, ...fields }, "task threw while aborting");
		}

		return { status: "aborted" };
	}

	const message = describeError(failure);

	logger.error({ err: failure, ...fields }, "task failed");

	return recordTerminal(
		() => failTask(db, task.id, task.runnerId, message),
		{ status: "failed", error: message },
		logger,
		fields,
	);
}
