import { createHash } from "node:crypto";

const PREFIX = "virtool-ts@";

/**
 * Postgres stores `application_name` in a `NAMEDATALEN` buffer and silently
 * truncates anything longer.
 */
const MAX_LENGTH = 63;

const DIGEST_LENGTH = 16;

/**
 * Build the `application_name` this process sets on every Postgres connection.
 *
 * The value has to survive the round trip: connections are opened with it, and
 * `pg_stat_activity` is later filtered on the identical string. A name Postgres
 * truncates on the way in matches nothing on the way out, and the pool gauges
 * silently report zero.
 *
 * A hostname long enough to overflow gets replaced by a digest rather than
 * clipped, because orchestrators put the part that distinguishes one replica
 * from another — the pod's random suffix — at the *end*. Truncating would
 * collapse every replica of a deployment onto one name and multiply its counts.
 */
export function buildApplicationName(host: string): string {
	const full = `${PREFIX}${host}`;

	if (Buffer.byteLength(full) <= MAX_LENGTH) {
		return full;
	}

	const digest = createHash("sha256")
		.update(host)
		.digest("hex")
		.slice(0, DIGEST_LENGTH);

	return `${PREFIX}${digest}`;
}
