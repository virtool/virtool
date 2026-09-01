// Deterministic retry policy for outbox delivery.

/**
 * How many delivery attempts a row gets before it fails terminally.
 *
 * With the backoff below, eight attempts spread over roughly an hour and a
 * half — enough to ride out a provider incident, short enough that an
 * auth-link email is not delivered a day after its token expired.
 */
export const EMAIL_MAX_ATTEMPTS = 8;

/** First retry delay, in seconds. */
const BASE_DELAY_SECONDS = 30;

/** Ceiling every delay is clamped to, in seconds. */
const MAX_DELAY_SECONDS = 3600;

/** Jitter fraction: each delay lands within ±20% of its nominal value. */
const JITTER = 0.2;

/**
 * Seconds to wait before the next attempt.
 *
 * Provider guidance wins when present: a `Retry-After` is what the provider
 * asked for, so it is honored as given — clamped to the ceiling, never
 * jittered shorter than requested. Otherwise the delay doubles per attempt
 * from {@link BASE_DELAY_SECONDS}, capped, with full ±{@link JITTER} spread so
 * a burst of failures does not retry as a burst.
 *
 * `random` is injectable for tests and defaults to `Math.random`.
 */
export function computeEmailRetryDelay(
	attempt: number,
	retryAfterSeconds: number | undefined,
	random: () => number = Math.random,
): number {
	if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
		return Math.min(MAX_DELAY_SECONDS, Math.ceil(retryAfterSeconds));
	}

	const nominal = Math.min(
		MAX_DELAY_SECONDS,
		BASE_DELAY_SECONDS * 2 ** Math.max(0, attempt - 1),
	);

	return Math.round(nominal * (1 - JITTER + 2 * JITTER * random()));
}
