import type { Logger } from "@virtool/logger";

// This lives here rather than as a module of `apps/jobs-api` or `apps/tasks`
// because both processes wind down the same way, and the two drifting apart
// is how one of them would quietly stop flushing Sentry.

/** Exit code set when every step of the sequence ran within its budget. */
const EXIT_CLEAN = 0;

/** Exit code set when a step failed, or the backstop fired before the end. */
const EXIT_UNCLEAN = 1;

/** How the shutdown sequence ended. */
type Outcome = "clean" | "failed" | "overran";

/** One step of the sequence — a registered hook or a fixed step — and its name. */
type Step = {
	name: string;
	run: () => Promise<void>;
	/**
	 * A ceiling of its own, in milliseconds, instead of an equal share.
	 *
	 * See {@link ShutdownOptions.timeoutMs}.
	 */
	timeoutMs?: number;
};

/** How a registered hook departs from the equal-share budget. */
export type ShutdownOptions = {
	/**
	 * Bound this hook explicitly rather than giving it an equal share.
	 *
	 * Equal division suits steps whose duration is a socket close or a buffer
	 * flush, where a share is always more than enough. It badly under-serves a
	 * hook that has to wait out *work* — draining a task a runner is mid-way
	 * through — because the ceiling on any one step is the budget divided by the
	 * number of steps, however little the others need.
	 *
	 * A hook that declares one takes the smaller of it and the time left, and
	 * that amount is reserved out of what the unbudgeted steps behind it divide,
	 * so declaring one cannot starve them. Keep the sum comfortably under
	 * {@link ShutdownDeps.timeout}: the remainder is what closes the listener,
	 * drains the pool and flushes Sentry.
	 */
	timeoutMs?: number;
};

/** What a step that never settled resolves to, rather than its own value. */
const OVERRAN = Symbol("overran");

/** What {@link createShutdownController} needs to wind the process down. */
export type ShutdownDeps = {
	logger: Logger;
	/** Flip readiness. Called with `false` before any hook runs. */
	setReady: (ready: boolean) => void;
	/** Stop accepting probes. Runs after every hook. */
	closeListener: () => Promise<void>;
	/** Drain the Postgres pool. Runs last, so a hook may still write. */
	closeDatabase: () => Promise<void>;
	/** Flush buffered Sentry envelopes. Never `close()` — see below. */
	flushSentry: () => Promise<void>;
	/** Seconds the whole sequence may take before the backstop gives up. */
	timeout: number;
};

/** The shutdown surface {@link createShutdownController} returns. */
export type ShutdownController = {
	onShutdown: (
		name: string,
		hook: () => Promise<void>,
		options?: ShutdownOptions,
	) => void;
	/** Run the sequence. Safe to call more than once; later calls are ignored. */
	shutdown: (signal: string) => Promise<void>;
	/** Register SIGTERM and SIGINT handlers. */
	listen: () => void;
};

/**
 * Resolve what `promise` reports, or `"overran"` once `ms` have passed.
 *
 * `promise` settling `false` is a sequence that ran to the end with at least
 * one failed step, and a rejection is one that could not — neither is a clean
 * shutdown, and neither may be reported as one.
 */
function withBackstop(promise: Promise<boolean>, ms: number): Promise<Outcome> {
	return new Promise<Outcome>((resolve) => {
		const timer = setTimeout(() => resolve("overran"), ms);

		// Without this the timer holds the event loop open for its full duration
		// on an otherwise clean shutdown, so a process that finished winding down
		// in 200 ms would still sit there for the whole budget before exiting.
		timer.unref();

		promise.then(
			(ok) => {
				clearTimeout(timer);
				resolve(ok ? "clean" : "failed");
			},
			() => {
				clearTimeout(timer);
				resolve("failed");
			},
		);
	});
}

/**
 * Resolve what `promise` reports, or {@link OVERRAN} once `ms` have passed.
 *
 * The abandoned promise is left running — nothing here can cancel a socket
 * that will not close — but the handlers attached below stay attached, so a
 * rejection arriving after the deadline is still handled and cannot take the
 * process down mid-shutdown.
 */
function withDeadline<T>(
	promise: Promise<T>,
	ms: number,
): Promise<T | typeof OVERRAN> {
	return new Promise<T | typeof OVERRAN>((resolve, reject) => {
		const timer = setTimeout(() => resolve(OVERRAN), ms);

		timer.unref();

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});
}

/**
 * Build this process's shutdown sequence.
 *
 * **Registering a SIGTERM listener removes Node's default exit behaviour**, so
 * from that moment exiting is entirely this module's responsibility.
 *
 * It discharges that with `process.exitCode` and a natural drain, never
 * `process.exit()`. Node's own documentation is explicit that `exit()` forces
 * the process down "even if there are still asynchronous operations pending",
 * writes to `process.stdout` included — which here means a dropped pino line,
 * an unsent Sentry envelope, and an uncommitted transaction.
 *
 * The ordering is fixed, and each step is awaited before the next:
 *
 * 1. Readiness flips to unavailable. The listener stays up, so the kubelet
 *    still gets an answer rather than a connection refused.
 * 2. Registered hooks run in **reverse registration order**, each awaited. A
 *    hook that throws is logged and does not abort the ones after it.
 * 3. The probe listener closes.
 * 4. The database pool drains — after the hooks, so a hook may still write.
 *    Releasing a task claim is exactly that.
 * 5. Sentry flushes. `flush()`, never `close()`: `close()` flushes *and*
 *    disables, so anything raised later in shutdown goes unreported.
 *
 * **No step can abort the ones after it, and none can pass unreported.** Each
 * is caught and logged on its own, so a listener that will not close still
 * leaves the pool to drain; and any failure — a hook's included — is what the
 * process exits `1` on, so a shutdown that failed is never indistinguishable
 * from one that did not.
 *
 * That holds for a step that *hangs* as well as one that throws, which is why
 * the budget is divided rather than pooled: every step gets a share of the time
 * still left when it starts, and is abandoned once that share is spent.
 * Awaiting the sequence against a single deadline would let one stuck socket eat
 * the whole budget and take the pool drain and the Sentry flush down with it —
 * so the failure would go unrecorded precisely when there was something to
 * record.
 *
 * The share is **equal**, except for a hook that declares a
 * {@link ShutdownOptions.timeoutMs} of its own. Equal division is right for a
 * socket close or a buffer flush, and wrong for a hook waiting out work: the
 * ceiling on any one step is the budget over the number of steps, however
 * little the rest need. A declared ceiling is reserved out of what the
 * unbudgeted steps divide, so it cannot starve them.
 *
 * A step whose share runs out is abandoned, not cancelled — nothing here can
 * force a socket closed — so the process may still have to be reaped rather
 * than draining on its own. What the division buys is that everything *after*
 * the stuck step still runs.
 *
 * The whole sequence is bounded by the backstop as well, which should now
 * never be what ends it. The budget must stay strictly under
 * `terminationGracePeriodSeconds` — which covers `preStop` and shutdown
 * together — or SIGKILL lands first and the process gets neither a clean
 * shutdown nor a controlled failure.
 */
export function createShutdownController(
	deps: ShutdownDeps,
): ShutdownController {
	const hooks: Step[] = [];
	let started = false;

	async function runStep(step: Step, ms: number): Promise<boolean> {
		try {
			if ((await withDeadline(step.run(), ms)) === OVERRAN) {
				deps.logger.error({ ms, step: step.name }, "shutdown step overran");
				return false;
			}

			deps.logger.debug({ step: step.name }, "ran shutdown step");

			return true;
		} catch (err) {
			deps.logger.error({ err, step: step.name }, "shutdown step failed");
			return false;
		}
	}

	async function sequence(): Promise<boolean> {
		deps.setReady(false);

		const steps: Step[] = [
			// Reverse registration order: a hook registered later may depend on what
			// an earlier one set up, so it has to come down first.
			...[...hooks].reverse(),
			{ name: "closeListener", run: deps.closeListener },
			{ name: "closeDatabase", run: deps.closeDatabase },
			{ name: "flushSentry", run: deps.flushSentry },
		];

		const deadline = performance.now() + deps.timeout * 1000;
		const results: boolean[] = [];

		for (const [index, step] of steps.entries()) {
			// Each step gets a share of whatever is left, so one that never settles is
			// abandoned with time still on the clock for the rest. A step that
			// finishes early hands the remainder on to the steps behind it.
			const remaining = Math.max(0, deadline - performance.now());

			// What the steps behind this one have claimed explicitly is subtracted
			// before the rest is divided, so a hook that declares a ceiling reserves
			// its time rather than taking it out of the pool drain's.
			const reserved = steps
				.slice(index + 1)
				.reduce((total, later) => total + (later.timeoutMs ?? 0), 0);

			const unbudgeted = steps
				.slice(index)
				.filter((each) => each.timeoutMs === undefined).length;

			const share =
				step.timeoutMs === undefined
					? Math.max(0, remaining - reserved) / unbudgeted
					: Math.min(step.timeoutMs, remaining);

			results.push(await runStep(step, share));
		}

		// Every step runs and every result is collected, rather than the first
		// failure aborting the rest: a listener that would not close is no reason
		// to leave the pool undrained or the Sentry buffer unflushed. The collected
		// results are what stop a failed shutdown reporting itself as a clean one.
		return results.every((ok) => ok);
	}

	async function shutdown(signal: string): Promise<void> {
		if (started) {
			// A second signal must not re-enter the sequence: hooks would run twice
			// and the pool would be closed out from under the first pass.
			deps.logger.warn({ signal }, "already shutting down");
			return;
		}

		started = true;

		deps.logger.info({ signal }, "shutting down");

		const outcome = await withBackstop(sequence(), deps.timeout * 1000);

		if (outcome === "clean") {
			deps.logger.info("shutdown complete");
			process.exitCode = EXIT_CLEAN;
			return;
		}

		if (outcome === "failed") {
			deps.logger.error("shutdown finished with failed steps");
			process.exitCode = EXIT_UNCLEAN;
			return;
		}

		deps.logger.error(
			{ timeout: deps.timeout },
			"shutdown did not finish within its budget",
		);

		process.exitCode = EXIT_UNCLEAN;
	}

	return {
		onShutdown(name, run, options) {
			hooks.push({
				name,
				run,
				...(options?.timeoutMs !== undefined && {
					timeoutMs: options.timeoutMs,
				}),
			});
		},

		shutdown,

		listen() {
			for (const signal of ["SIGINT", "SIGTERM"] as const) {
				process.on(signal, () => {
					void shutdown(signal);
				});
			}
		},
	};
}
