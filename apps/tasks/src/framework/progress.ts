import type { Db } from "@virtool/data/db/pg";
import { updateTaskProgress } from "@virtool/data/tasks/data";
import type { Logger } from "@virtool/logger";

/**
 * How long progress writes are coalesced for.
 *
 * A body that reports per read pair, or per HMM profile, would otherwise cost
 * one `UPDATE` and one `tasks` frame per item — and every frame is a refetch in
 * every connected browser. A quarter of a second is below what a progress bar
 * needs to look continuous, so nothing is lost by holding writes for it.
 */
export const PROGRESS_DEBOUNCE_MS = 250;

/**
 * Round the way Python's `round` does, breaking a tie to the even side.
 *
 * `Math.round` breaks ties upward, so it disagrees with Python on every exact
 * half — `round(62.5)` is 62 there and 63 here. Progress is cosmetic, but
 * Python still runs tasks until the cutover completes, and two runners writing
 * different numbers for the same step of the same task type is a difference
 * nobody would be able to explain later.
 */
export function roundHalfToEven(value: number): number {
	const floor = Math.floor(value);
	const remainder = value - floor;

	if (remainder > 0.5) {
		return floor + 1;
	}

	if (remainder < 0.5) {
		return floor;
	}

	return floor % 2 === 0 ? floor : floor + 1;
}

/** A change to a task row's progress, its step name, or both. */
export type ProgressValues = {
	progress?: number;
	step?: string;
};

/** Coalesces progress writes for one running task. */
export type ProgressWriter = {
	/** Record a change, to be written when the debounce window closes. */
	set: (values: ProgressValues) => void;
	/** Record a change and write it now, superseding anything pending. */
	setNow: (values: ProgressValues) => Promise<void>;
	/** Write anything still pending and wait for every write to land. */
	flush: () => Promise<void>;
	/** Whether a write has found the task no longer held by this runner. */
	isFenced: () => boolean;
};

/** What {@link createProgressWriter} needs to write a task's progress. */
export type ProgressWriterOptions = {
	db: Db;
	taskId: number;
	runnerId: string;
	logger: Logger;
	/**
	 * The progress already on the row, which the monotonic rule is measured
	 * against. Defaults to 0.
	 */
	progress?: number;
	/** Defaults to {@link PROGRESS_DEBOUNCE_MS}. */
	debounceMs?: number;
};

/**
 * Build the writer a running task reports through.
 *
 * It holds three guarantees the framework rests on. Progress never goes
 * backwards: a value below one already recorded is dropped, so a rounding
 * wobble or a retried chunk inside a data function cannot destroy an otherwise
 * healthy task the way Python's raising handler does. Writes never overlap: one
 * is chained behind the last, so a flush cannot race a debounced write into
 * writing the older value second. And a write that matches nothing fences the
 * writer for good — the task belongs to another runner from that moment, and
 * this one must stop writing and stop emitting rather than announce a state the
 * row is not in.
 *
 * The monotonic rule is measured from `options.progress`, the value already on
 * the row, and not from zero. A reclaimed task re-runs from step zero, so its
 * first step would otherwise write the bar back to 0 — a run that resumes at
 * 87% must hold there until it passes it again.
 */
export function createProgressWriter(
	options: ProgressWriterOptions,
): ProgressWriter {
	const { db, taskId, runnerId, logger } = options;
	const debounceMs = options.debounceMs ?? PROGRESS_DEBOUNCE_MS;

	let progress = options.progress ?? 0;
	let step: string | undefined;
	let pending = false;
	let timer: NodeJS.Timeout | undefined;
	let queue: Promise<void> = Promise.resolve();
	let fenced = false;

	async function write(): Promise<void> {
		if (fenced) {
			return;
		}

		try {
			const held = await updateTaskProgress(db, taskId, runnerId, {
				progress,
				...(step !== undefined && { step }),
			});

			if (!held) {
				fenced = true;
				logger.warn(
					{ task_id: taskId },
					"stopped writing progress for a task this runner no longer holds",
				);
			}
		} catch (err) {
			// Progress is cosmetic, and a task that did its work must not be failed
			// over a bar that did not move. A database that is genuinely gone will
			// surface on the terminal write, which goes through the same pool.
			logger.warn({ err, task_id: taskId }, "failed to write task progress");
		}
	}

	function enqueue(): void {
		queue = queue.then(write);
	}

	function clearTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	/** Fold `values` into the intended row state, and report whether it moved. */
	function apply(values: ProgressValues): boolean {
		let changed = false;

		if (values.progress !== undefined) {
			if (values.progress > progress) {
				progress = values.progress;
				changed = true;
			} else if (values.progress < progress) {
				logger.debug(
					{ task_id: taskId, progress: values.progress, recorded: progress },
					"ignored a task progress decrease",
				);
			}
		}

		if (values.step !== undefined && values.step !== step) {
			step = values.step;
			changed = true;
		}

		return changed;
	}

	function set(values: ProgressValues): void {
		if (fenced || !apply(values)) {
			return;
		}

		pending = true;

		if (timer === undefined) {
			timer = setTimeout(() => {
				timer = undefined;

				if (pending) {
					pending = false;
					enqueue();
				}
			}, debounceMs);

			// A pending progress write must never be the reason the process stays
			// alive; the terminal path flushes it.
			timer.unref();
		}
	}

	async function setNow(values: ProgressValues): Promise<void> {
		const changed = apply(values);

		clearTimer();

		if (changed || pending) {
			pending = false;
			enqueue();
		}

		await queue;
	}

	async function flush(): Promise<void> {
		clearTimer();

		if (pending) {
			pending = false;
			enqueue();
		}

		await queue;
	}

	return { set, setNow, flush, isFenced: () => fenced };
}
