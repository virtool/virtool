import { lt } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";

// The longest window of any budget kept in `auth_rate_limits`: the recovery
// target budget. A row older than this can't affect any budget.
const RATE_LIMIT_RETENTION_MS = 60 * 60_000;

/** Delete rate-limit rows whose window has ended for every budget. */
export async function pruneAuthRateLimits(db: Db): Promise<number> {
	const deleted = await db
		.delete(authRateLimits)
		.where(lt(authRateLimits.lastRequest, Date.now() - RATE_LIMIT_RETENTION_MS))
		.returning({ id: authRateLimits.id });
	return deleted.length;
}
