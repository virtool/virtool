import type { Db } from "../db/pg";
import { getRateLimitKey, spendRateLimit } from "./rateLimits";

const REQUESTER_RULE = { window: 60, max: 5 };
const TARGET_RULE = { window: 60 * 60, max: 3 };

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
	const requesterAllowed = await spendRateLimit(
		db,
		getRateLimitKey("recovery", "requester", requesterDigest),
		REQUESTER_RULE,
	);
	if (!requesterAllowed) {
		return false;
	}
	return spendRateLimit(
		db,
		getRateLimitKey("recovery", "target", targetDigest),
		TARGET_RULE,
	);
}
