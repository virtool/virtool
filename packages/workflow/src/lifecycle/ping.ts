import type { Logger } from "@virtool/logger";
import type { JobsApiClient } from "../client/client";
import { UnauthorizedError } from "../client/errors";
import { sleep } from "../client/retry";
import type { RunSignals } from "../run";

/** Delay before the first ping, spreading a wave of pods' heartbeats out. */
export const PING_STAGGER_MS = 100;

/** Delay between pings. */
export const PING_INTERVAL_MS = 5_000;

/**
 * Consecutive failures before the loop gives up.
 *
 * With retries disabled on the ping request, five failures at a 5 s cadence is
 * a give-up window of roughly 20 s. The jobs API fails a running job whose
 * last ping is more than **five minutes** old, so the pod stops heartbeating
 * well inside the sweep — which is the whole point of owning the retry policy
 * here rather than inheriting a hidden 25 s of retries per attempt.
 */
export const MAX_PING_FAILURES = 5;

/** A running ping loop. */
export type PingLoop = {
	/** Stops the loop. Safe to call more than once, and after it has stopped itself. */
	stop: () => Promise<void>;
};

/** Options for {@link startPingLoop}. */
export type StartPingLoopOptions = {
	client: JobsApiClient;
	logger: Logger;
	signals: RunSignals;
	intervalMs?: number;
};

/**
 * Heartbeat the jobs API for as long as the run lasts.
 *
 * This is also the cancellation channel, and **a refusal is the signal**. A job
 * key stops authenticating the moment its job reaches a terminal state, so a
 * ping answered `401` means the job is over — cancelled by a user, or failed by
 * the jobs API's stalled-job sweep after this pod lost contact. Either way there
 * is nothing left for the run to report, so the loop aborts the run's signal and
 * unwinds it.
 *
 * A `401` is also what a genuinely broken credential produces, and the loop
 * cannot tell the two apart. It does not need to — the response is the same
 * either way — but the jobs API names the state in the body, so the log line
 * carries the message rather than asserting a cancellation. A pod stopping on
 * `Invalid credentials` rather than `Job is cancelled.` is a bug that would
 * otherwise be invisible.
 *
 * Every other failure is a transport problem and counts toward the give-up
 * budget. Failures are counted **consecutively** and reset on success. Python's
 * counter never decrements, so a run long enough to accumulate six scattered
 * blips stops pinging forever and is then failed by the sweep while still
 * working.
 */
export function startPingLoop({
	client,
	logger,
	signals,
	intervalMs = PING_INTERVAL_MS,
}: StartPingLoopOptions): PingLoop {
	const controller = new AbortController();

	async function loop(): Promise<void> {
		let failures = 0;

		await sleep(PING_STAGGER_MS, controller.signal);

		while (!controller.signal.aborted) {
			try {
				// Bound by the loop's own signal, not just the run's. On a successful
				// run nothing aborts the run signal, so a hung ping would otherwise
				// hold `stop()` open for the 600 s request budget with the finish call
				// queued behind it — long enough for the sweep to fail a job whose
				// work is already done.
				await client.ping(controller.signal);

				failures = 0;
			} catch (err) {
				// The run's own abort races the `stop()` call that follows it, so a
				// ping already in flight rejects on a signal that means the run is
				// over rather than that the jobs API is unreachable.
				if (controller.signal.aborted || signals.signal.aborted) {
					return;
				}

				// The job key no longer authenticates, which is only true once the
				// job has reached a terminal state. Retrying cannot help and the run
				// has nothing left to report, so stop now rather than working on for
				// a job that is already over.
				if (err instanceof UnauthorizedError) {
					logger.info(
						{ reason: err.message },
						"jobs API refused the job key; the job is no longer active",
					);

					signals.cancel();

					return;
				}

				failures += 1;

				if (failures >= MAX_PING_FAILURES) {
					logger.warn(
						{ err, failures },
						"giving up on pinging the jobs API; the job will be failed by its ping timeout while this pod keeps running",
					);

					return;
				}

				logger.info({ err, failures }, "jobs API ping failed");
			}

			await sleep(intervalMs, controller.signal);
		}
	}

	const running = loop();

	return {
		async stop() {
			controller.abort();

			await running;
		},
	};
}
