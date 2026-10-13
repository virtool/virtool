import type { Logger } from "@virtool/logger";
import type { JobsApiClient } from "../client/client";
import { UnauthorizedError } from "../client/errors";
import { RETRY_WINDOW_MS, sleep } from "../client/retry";
import type { RunSignals } from "../run";

/** Delay before the first ping, spreading a wave of pods' heartbeats out. */
export const PING_STAGGER_MS = 100;

/** Delay between pings. */
export const PING_INTERVAL_MS = 5_000;

/**
 * Time without a successful ping before the loop gives up, in milliseconds.
 *
 * With retries disabled on the ping request, this is the whole give-up window:
 * long enough to outlast a Postgres maintenance restart, which the jobs API
 * answers with 503. The jobs API fails a running job whose last ping is more
 * than **five minutes** old, so the pod stops heartbeating inside the sweep —
 * which is the whole point of owning the retry policy here rather than
 * inheriting hidden retries per attempt. It matches the request retry window,
 * so other lifecycle requests stop retrying when pings stop.
 *
 * It is measured in wall-clock time rather than failures because a ping that
 * hangs until its socket times out takes far longer than the ping interval.
 */
export const PING_GIVE_UP_MS = RETRY_WINDOW_MS;

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
 * Every other failure is a transport problem. The loop gives up once
 * {@link PING_GIVE_UP_MS} has passed since the last success, and an in-flight
 * ping is aborted at that deadline. Measuring from the last success means
 * scattered blips over a long run never add up to a give-up, which would let
 * the sweep fail the job while it was still working.
 */
export function startPingLoop({
	client,
	logger,
	signals,
	intervalMs = PING_INTERVAL_MS,
}: StartPingLoopOptions): PingLoop {
	const controller = new AbortController();

	async function loop(): Promise<void> {
		let deadline = Date.now() + PING_GIVE_UP_MS;
		let failures = 0;

		await sleep(PING_STAGGER_MS, controller.signal);

		while (!controller.signal.aborted) {
			try {
				// Bound by the give-up deadline and the loop's own signal, not just the
				// run's. On a successful run nothing aborts the run signal, so a hung
				// ping would otherwise hold `stop()` open for the 600 s request budget
				// with the finish call queued behind it — long enough for the sweep to
				// fail a job whose work is already done.
				const expiry = new AbortController();
				const timer = setTimeout(
					() => expiry.abort(),
					Math.max(0, deadline - Date.now()),
				);

				try {
					await client.ping(
						AbortSignal.any([controller.signal, expiry.signal]),
					);
				} finally {
					clearTimeout(timer);
				}

				deadline = Date.now() + PING_GIVE_UP_MS;
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

				if (Date.now() >= deadline) {
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
