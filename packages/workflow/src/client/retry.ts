import type { Logger } from "@virtool/logger";
import { TransportError } from "./errors";

/** Attempts after the first. Matches Python's `API_MAX_RETRIES`. */
export const MAX_RETRIES = 5;

/**
 * Delay between attempts, in milliseconds. **Flat, not exponential.**
 *
 * Python's `retry` decorator only backs off exponentially when a caller passes
 * a non-default `base_delay`, and nothing does — so the observed behaviour is
 * six attempts spread over 25 s, which is what the jobs API's five-minute
 * ping-timeout sweep is calibrated against. Do not "improve" this.
 */
export const RETRY_DELAY_MS = 5_000;

/**
 * Sleep, returning early if the signal aborts.
 *
 * Resolves rather than rejecting on abort, so every caller handles the two the
 * same way — by checking the signal — instead of half of them catching. The
 * timer is always cleared, so a stopped loop leaves nothing holding the event
 * loop open.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		};

		const timer = setTimeout(done, ms);

		signal?.addEventListener("abort", done, { once: true });
	});
}

/** Options for {@link withRetry}. */
export type WithRetryOptions = {
	logger: Logger;
	/** Attempts after the first. Defaults to {@link MAX_RETRIES}; 0 disables retrying. */
	retries?: number;
	/** Cuts a retry sleep short so a cancelled run does not wait out the remaining 25 s. */
	signal?: AbortSignal;
};

/**
 * Run a request, retrying transport failures at a flat delay.
 *
 * Only {@link TransportError} is retried. Anything else — a status the control
 * plane chose, a response that failed to parse, an abort — propagates on the
 * first attempt.
 */
export async function withRetry<T>(
	attempt: () => Promise<T>,
	{ logger, retries = MAX_RETRIES, signal }: WithRetryOptions,
): Promise<T> {
	for (let attemptIndex = 0; ; attemptIndex++) {
		try {
			return await attempt();
		} catch (err) {
			if (!(err instanceof TransportError)) {
				throw err;
			}

			if (attemptIndex >= retries) {
				logger.warn(
					{ err, attempts: attemptIndex + 1 },
					"giving up on jobs API request after exhausting retries",
				);

				throw err;
			}

			logger.info(
				{ attempt: attemptIndex + 1, delayMs: RETRY_DELAY_MS, err },
				"retrying jobs API request after transport failure",
			);

			await sleep(RETRY_DELAY_MS, signal);

			if (signal?.aborted) {
				throw err;
			}
		}
	}
}
