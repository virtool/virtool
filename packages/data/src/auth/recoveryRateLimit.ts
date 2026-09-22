import { and, lt, sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";

const RECOVERY_KEY_PREFIX = "virtool:recovery:";
const REQUESTER_WINDOW_MS = 60_000;
const TARGET_WINDOW_MS = 60 * 60_000;

async function recordAttempt(
	db: Db,
	key: string,
	windowMs: number,
	limit: number,
): Promise<boolean> {
	const nowMs = sql<number>`floor(extract(epoch from clock_timestamp()) * 1000)`;
	const [row] = await db
		.insert(authRateLimits)
		.values({ key, count: 1, lastRequest: Date.now() })
		.onConflictDoUpdate({
			target: authRateLimits.key,
			set: {
				count: sql`case when ${authRateLimits.lastRequest} < ${nowMs} - ${windowMs} then 1 else ${authRateLimits.count} + 1 end`,
				lastRequest: nowMs,
			},
		})
		.returning({ count: authRateLimits.count });
	return (row?.count ?? limit + 1) <= limit;
}

/** Check and record both bounded recovery-request budgets. */
export async function checkRecoveryRequestBudget(
	db: Db,
	requesterDigest: string,
	targetDigest: string,
): Promise<boolean> {
	const [requesterAllowed, targetAllowed] = await Promise.all([
		recordAttempt(
			db,
			`${RECOVERY_KEY_PREFIX}requester:${requesterDigest}`,
			REQUESTER_WINDOW_MS,
			5,
		),
		recordAttempt(
			db,
			`${RECOVERY_KEY_PREFIX}target:${targetDigest}`,
			TARGET_WINDOW_MS,
			3,
		),
	]);
	return requesterAllowed && targetAllowed;
}

/** Remove only Virtool's expired recovery budgets from the shared rate-limit table. */
export async function pruneRecoveryRequestBudgets(db: Db): Promise<number> {
	const deleted = await db
		.delete(authRateLimits)
		.where(
			and(
				sql`${authRateLimits.key} like ${`${RECOVERY_KEY_PREFIX}%`}`,
				lt(authRateLimits.lastRequest, Date.now() - TARGET_WINDOW_MS),
			),
		)
		.returning({ id: authRateLimits.id });
	return deleted.length;
}
