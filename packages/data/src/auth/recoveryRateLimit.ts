import { sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";

const RECOVERY_KEY_PREFIX = "virtool:recovery:";
const REQUESTER_WINDOW_MS = 60_000;
const TARGET_WINDOW_MS = 60 * 60_000;

/**
 * Spend one attempt from a fixed window, and report whether it was allowed.
 *
 * `last_request` holds the start of the window. A refused attempt writes
 * nothing, so repeated requests can't extend a window past its end.
 */
async function spendAttempt(
	db: Db,
	key: string,
	windowMs: number,
	limit: number,
): Promise<boolean> {
	// One value per statement, so both columns agree on whether the window ended.
	const nowMs = sql<number>`floor(extract(epoch from statement_timestamp()) * 1000)`;
	const windowEnded = sql`${authRateLimits.lastRequest} <= ${nowMs} - ${windowMs}`;
	const [row] = await db
		.insert(authRateLimits)
		.values({ key, count: 1, lastRequest: nowMs })
		.onConflictDoUpdate({
			target: authRateLimits.key,
			set: {
				count: sql`case when ${windowEnded} then 1 else ${authRateLimits.count} + 1 end`,
				lastRequest: sql`case when ${windowEnded} then ${nowMs} else ${authRateLimits.lastRequest} end`,
			},
			setWhere: sql`${windowEnded} or ${authRateLimits.count} < ${limit}`,
		})
		.returning({ id: authRateLimits.id });
	return row !== undefined;
}

/**
 * Spend one attempt from the requester budget, then the target budget.
 *
 * The target budget is spent only once the requester budget allows the attempt,
 * so a blocked address can't drain another account's budget.
 */
export async function checkRecoveryRequestBudget(
	db: Db,
	requesterDigest: string,
	targetDigest: string,
): Promise<boolean> {
	const requesterAllowed = await spendAttempt(
		db,
		`${RECOVERY_KEY_PREFIX}requester:${requesterDigest}`,
		REQUESTER_WINDOW_MS,
		5,
	);
	if (!requesterAllowed) {
		return false;
	}
	return spendAttempt(
		db,
		`${RECOVERY_KEY_PREFIX}target:${targetDigest}`,
		TARGET_WINDOW_MS,
		3,
	);
}
