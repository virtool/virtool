/**
 * How long a row may go on being retried, in seconds, measured from
 * `created_at`.
 *
 * This is the terminal condition for a row that keeps failing. A provider
 * incident, and an exhausted daily or monthly quota above all, outlasts the
 * backoff ladder by hours, so the row waits on the clock rather than on a
 * count of attempts.
 *
 * Six hours rides out a long incident while staying inside the lifetime of
 * the tokens in the auth-link templates, so a link is never delivered after
 * its token expired. No flow mints those tokens yet; a flow that adds one
 * must not give it a lifetime shorter than this value without shortening this
 * value with it.
 */
export const EMAIL_DELIVERY_DEADLINE_SECONDS = 6 * 3600;

/**
 * How many delivery attempts a row gets, as a backstop.
 *
 * {@link EMAIL_DELIVERY_DEADLINE_SECONDS} is what usually ends a failing row.
 * This bound only stops a row that somehow retries faster than the backoff
 * intends, so it sits well past the number of attempts the ladder fits inside
 * the deadline.
 */
export const EMAIL_MAX_ATTEMPTS = 16;

/** First retry delay, in seconds. */
const BASE_DELAY_SECONDS = 30;

/** Ceiling the computed backoff is clamped to, in seconds. */
const MAX_DELAY_SECONDS = 3600;

/** Ceiling provider `Retry-After` guidance is clamped to, in seconds. */
const MAX_RETRY_AFTER_SECONDS = 24 * 3600;

/** Jitter fraction: each delay lands within ±20% of its nominal value. */
const JITTER = 0.2;

/** Seconds left before the deadline passes for a row created at `createdAt`. */
export function getEmailDeliveryRemainingSeconds(
	createdAt: Date,
	now: Date = new Date(),
): number {
	const elapsed = (now.getTime() - createdAt.getTime()) / 1000;

	return Math.max(0, EMAIL_DELIVERY_DEADLINE_SECONDS - elapsed);
}

/** Whether `createdAt` is older than {@link EMAIL_DELIVERY_DEADLINE_SECONDS}. */
export function isEmailDeliveryExpired(
	createdAt: Date,
	now: Date = new Date(),
): boolean {
	return getEmailDeliveryRemainingSeconds(createdAt, now) === 0;
}

/**
 * Seconds to wait before the next attempt.
 *
 * Provider guidance wins when present: a `Retry-After` is what the provider
 * asked for, so it is honored as given, never jittered, and clamped only at
 * {@link MAX_RETRY_AFTER_SECONDS}. A quota reset a day out is therefore waited
 * on instead of retried against, though the caller clamps the wait to what is
 * left of the deadline. Otherwise the delay doubles per attempt from
 * {@link BASE_DELAY_SECONDS}, clamped at {@link MAX_DELAY_SECONDS}, with full
 * ±{@link JITTER} spread so a burst of failures does not retry as a burst.
 *
 * `random` is injectable for tests and defaults to `Math.random`.
 */
export function computeEmailRetryDelay(
	attempt: number,
	retryAfterSeconds: number | undefined,
	random: () => number = Math.random,
): number {
	if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
		return Math.min(MAX_RETRY_AFTER_SECONDS, Math.ceil(retryAfterSeconds));
	}

	const nominal = Math.min(
		MAX_DELAY_SECONDS,
		BASE_DELAY_SECONDS * 2 ** Math.max(0, attempt - 1),
	);

	return Math.round(nominal * (1 - JITTER + 2 * JITTER * random()));
}
