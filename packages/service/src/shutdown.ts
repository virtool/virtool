import type { Logger } from "@virtool/logger";

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
	onShutdown: (name: string, hook: () => Promise<void>) => void;
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
 * the budget is divided rather than pooled: every step, each hook included,
 * gets an equal share of the time still left when it starts, and is abandoned
 * once that share is spent. Awaiting the sequence against a single deadline
 * would let one stuck socket eat the whole budget and take the pool drain and
 * the Sentry flush down with it — so the failure would go unrecorded precisely
 * when there was something to record.
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
			// Each step gets an equal share of whatever is left, so one that never
			// settles is abandoned with time still on the clock for the rest. A step
			// that finishes early hands the remainder on to the steps behind it.
			const share =
				Math.max(0, deadline - performance.now()) / (steps.length - index);

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
		onShutdown(name, run) {
			hooks.push({ name, run });
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
