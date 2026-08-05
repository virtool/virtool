import { createHash } from "node:crypto";

const PREFIX = "virtool-ts";

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
 * `service` names the process — `web`, `jobs-api` — and is what keeps the two
 * services' pools apart. They share a database, and on a developer machine they
 * share a hostname too, so without it each would count the other's backends and
 * both would report the sum.
 *
 * A hostname long enough to overflow gets replaced by a digest rather than
 * clipped, because orchestrators put the part that distinguishes one replica
 * from another — the pod's random suffix — at the *end*. Truncating would
 * collapse every replica of a deployment onto one name and multiply its counts.
 * The service segment is never digested away: it is short, bounded by the
 * number of services we ship, and it is the discriminator worth keeping legible.
 */
export function buildApplicationName(service: string, host: string): string {
	const prefix = `${PREFIX}-${service}@`;
	const full = `${prefix}${host}`;

	if (Buffer.byteLength(full) <= MAX_LENGTH) {
		return full;
	}

	const digest = createHash("sha256")
		.update(host)
		.digest("hex")
		.slice(0, DIGEST_LENGTH);

	return `${prefix}${digest}`;
}
