import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "bearer ";

/**
 * Check an `Authorization: Bearer <token>` header against the expected token
 * without leaking where the two first differ.
 *
 * Reached through the `@virtool/contracts/bearer` subpath rather than the
 * package barrel, so `node:crypto` never enters the browser graph.
 *
 * Shared by every service that gates a Prometheus scrape — `apps/web` and
 * `apps/jobs-api` both call it — because two copies of a constant-time
 * comparison are two chances to quietly regress one of them into `===`.
 *
 * `timingSafeEqual` throws on a length mismatch, so that case is screened
 * first. The screen reveals the configured token's length, which is not worth
 * defending: an attacker learns nothing that narrows the search meaningfully.
 *
 * The scheme is matched case-insensitively, as RFC 9110 §11.1 requires. The
 * credential after it is not — it is compared byte for byte, so a token that
 * differs only in case or surrounding whitespace is a different token.
 */
export function isBearerTokenValid(
	header: string | null | undefined,
	token: string,
): boolean {
	if (header?.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX) {
		return false;
	}

	const presented = Buffer.from(header.slice(BEARER_PREFIX.length));
	const expected = Buffer.from(token);

	if (presented.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(presented, expected);
}
