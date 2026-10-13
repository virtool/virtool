import type { Logger } from "@virtool/logger";
import { ServiceUnavailableError, TransportError } from "./errors";

/**
 * Attempts after the first.
 *
 * At the flat delay this spans about four minutes, which outlasts a Postgres
 * maintenance restart and still ends inside the jobs API's five-minute
 * ping-timeout sweep.
 */
export const MAX_RETRIES = 48;

/**
 * Delay between attempts, in milliseconds. **Flat, not exponential.**
 *
 * The retry window is calibrated against the jobs API's five-minute
 * ping-timeout sweep. Do not "improve" this into an exponential backoff.
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
	/** Cuts a retry sleep short so a cancelled run does not wait out the remaining window. */
	signal?: AbortSignal;
};

/**
 * Run a request, retrying transport failures and 503s at a flat delay.
 *
 * Only {@link TransportError} and {@link ServiceUnavailableError} are retried.
 * Anything else — a status the control plane chose, a response that failed to
 * parse, an abort — propagates on the first attempt.
 */
export async function withRetry<T>(
	attempt: () => Promise<T>,
	{ logger, retries = MAX_RETRIES, signal }: WithRetryOptions,
): Promise<T> {
	for (let attemptIndex = 0; ; attemptIndex++) {
		try {
			return await attempt();
		} catch (err) {
			if (
				!(err instanceof TransportError) &&
				!(err instanceof ServiceUnavailableError)
			) {
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
				"retrying jobs API request",
			);

			await sleep(RETRY_DELAY_MS, signal);

			if (signal?.aborted) {
				throw err;
			}
		}
	}
}
