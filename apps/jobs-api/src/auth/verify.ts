import { createHash, timingSafeEqual } from "node:crypto";

import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { eq } from "drizzle-orm";

/**
 * The states a job never leaves.
 *
 * Mirrors Python's `TERMINAL_JOB_STATES` in `virtool/jobs/models.py`.
 *
 * Reaching one of these is the **only** thing that stops a job key
 * authenticating. There is no expiry, no revocation list, no rotation, and no
 * way to invalidate a key while its job is still running — the column holds one
 * digest for the life of the row. So the state has to be re-read on every
 * request rather than trusted at claim time: a runner pod that outlives the job
 * it claimed still holds a syntactically valid credential, and this check is
 * what stops it being accepted.
 */
const TERMINAL_STATES = new Set(["cancelled", "failed", "succeeded"]);

/**
 * The `job-{id}` login carried by the Basic credentials.
 *
 * Anchored and case-sensitive. `apps/web` refuses any handle beginning with
 * `job` case-insensitively, because it matches handles that way and `JOB-1`
 * would otherwise resolve the very row `job-1` is refused. Nothing here is
 * case-folded — the login is not a handle, it is a literal prefix and an id —
 * so `JOB-1` is simply not a job login and gets the same 401 as anything else.
 */
const JOB_LOGIN = /^job-(\d+)$/;

/**
 * The largest value `jobs.id` can hold — it is a Postgres `integer`.
 *
 * `\d+` matches arbitrarily many digits, so without this an unauthenticated
 * caller could send `job-99999999999` and get a range error out of the driver:
 * a 500, and a stack frame in Sentry, for what is only a bad credential.
 */
const MAX_JOB_ID = 2_147_483_647;

/**
 * SHA-256 hex digest.
 *
 * A local copy of `hashToken` in `@virtool/data/auth/tokens`, which is itself a
 * copy of Python's `hash_key` at `virtool/utils.py:98-99`. All three have to
 * produce the same digest for the same input forever — `jobs.key` is written by
 * Python and read here — so this one is pinned against fixed vectors in
 * `verify.test.ts` rather than against either counterpart. A test that compared
 * the two implementations would pass just as happily if both drifted together.
 */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** The login and password carried by an HTTP Basic `Authorization` header. */
export type BasicCredentials = {
	login: string;
	key: string;
};

/**
 * Parse an HTTP Basic `Authorization` header into its login and password.
 * Returns `null` for anything malformed — a non-Basic scheme, undecodable
 * base64, a missing separator, or an empty login.
 *
 * A local copy of the function of the same name in
 * `apps/web/src/server/auth/verify.ts`. It cannot be imported: this service
 * must not reach into `apps/web`, and the shape is small enough that pushing it
 * down into a package would couple the job credential's parsing to the user
 * credential's for no gain. Both are pinned by their own fixed-vector tests.
 */
export function parseBasicAuthHeader(header: string): BasicCredentials | null {
	// RFC 7235 allows one *or more* spaces between the scheme and the
	// credentials, so split on runs of whitespace rather than a single space.
	// Requiring exactly two parts still rejects a header with trailing junk —
	// base64 contains no whitespace, so a third part means the header is broken.
	const parts = header.trim().split(/\s+/);

	if (parts.length !== 2) {
		return null;
	}

	const [scheme, encoded] = parts;

	if (scheme?.toLowerCase() !== "basic" || !encoded) {
		return null;
	}

	const decoded = Buffer.from(encoded, "base64").toString("utf8");
	const idx = decoded.indexOf(":");

	if (idx < 1) {
		return null;
	}

	return { login: decoded.slice(0, idx), key: decoded.slice(idx + 1) };
}

/**
 * The identity behind an authenticated request to this service.
 *
 * A job, and nothing else. There is deliberately no `userId` and no permission
 * set: a workflow pod acts as the job it claimed, not as the user who created
 * it, and every rule this service enforces is a rule about which job may touch
 * which row. Carrying the owner here would invite a handler to authorize
 * against them instead.
 */
export type JobPrincipal = {
	jobId: number;
};

/**
 * Resolve the job behind a request from its HTTP Basic `Authorization` header,
 * which a runner sends as `job-{id}:{key}`.
 *
 * Returns `null` for every failure — no header, a malformed one, a login that
 * is not a job, an unknown or keyless job, a wrong key, or a job that has
 * finished — so the caller answers one opaque 401 without saying which check
 * failed. There is **no cookie fallback**: this service has no session model
 * and nothing that reaches it holds a browser session.
 *
 * Mirrors Python's `virtool/jobs/auth.py` middleware, with two deliberate
 * differences. The login is matched against an anchored pattern rather than
 * `split("-")`, so `job-1-2` is refused rather than raising past the prefix
 * check by accident; and the key comparison is timing-safe, where Python's is a
 * plain `!=`.
 */
export async function verifyJobRequest(
	db: Db,
	request: Request,
): Promise<JobPrincipal | null> {
	const header = request.headers.get("authorization");

	if (!header) {
		return null;
	}

	const credentials = parseBasicAuthHeader(header);

	if (!credentials) {
		return null;
	}

	const digits = JOB_LOGIN.exec(credentials.login)?.[1];

	if (!digits) {
		return null;
	}

	const jobId = Number(digits);

	if (jobId < 1 || jobId > MAX_JOB_ID) {
		return null;
	}

	const [row] = await db
		.select({ key: jobs.key, state: jobs.state })
		.from(jobs)
		.where(eq(jobs.id, jobId))
		.limit(1);

	// A job that has no key was never claimed, so nothing can be authenticating
	// as it. Guarding here also keeps the comparison below off a null.
	if (!row?.key) {
		return null;
	}

	const expected = Buffer.from(row.key, "utf8");
	const provided = Buffer.from(hashToken(credentials.key), "utf8");

	// timingSafeEqual throws on a length mismatch, so the lengths are screened
	// first. Both sides are hex digests of a fixed-width hash, so a differing
	// length means the stored value is not one of ours and the screen leaks
	// nothing about the key itself.
	if (
		expected.length !== provided.length ||
		!timingSafeEqual(expected, provided)
	) {
		return null;
	}

	if (TERMINAL_STATES.has(row.state)) {
		return null;
	}

	return { jobId };
}
