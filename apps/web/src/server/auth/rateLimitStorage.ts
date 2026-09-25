import type { Db } from "@virtool/data/db/pg";
import { authRateLimits } from "@virtool/data/db/schema/auth";
import { eq, lt, or, sql } from "drizzle-orm";

type RateLimit = {
	key: string;
	count: number;
	lastRequest: number;
};

const PRUNE_INTERVAL_MS = 60 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;

/** Consume rate limits atomically across web instances. */
export function createRateLimitStorage(db: Db) {
	let lastPrunedAt = Date.now();

	async function get(key: string): Promise<RateLimit | undefined> {
		const [row] = await db
			.select({
				key: authRateLimits.key,
				count: authRateLimits.count,
				lastRequest: authRateLimits.lastRequest,
			})
			.from(authRateLimits)
			.where(eq(authRateLimits.key, key));

		return row;
	}

	async function set(key: string, value: RateLimit): Promise<void> {
		await db
			.insert(authRateLimits)
			.values({ key, count: value.count, lastRequest: value.lastRequest })
			.onConflictDoUpdate({
				target: authRateLimits.key,
				set: { count: value.count, lastRequest: value.lastRequest },
			});
	}

	async function consume(
		key: string,
		rule: { window: number; max: number },
	): Promise<{ allowed: boolean; retryAfter: number | null }> {
		const now = Date.now();
		const windowMs = rule.window * 1000;
		const cutoff = now - windowMs;

		if (now - lastPrunedAt >= PRUNE_INTERVAL_MS) {
			lastPrunedAt = now;
			await db
				.delete(authRateLimits)
				.where(lt(authRateLimits.lastRequest, now - RETENTION_MS));
		}

		const [spent] = await db
			.insert(authRateLimits)
			.values({ key, count: 1, lastRequest: now })
			.onConflictDoUpdate({
				target: authRateLimits.key,
				set: {
					count: sql`case when ${authRateLimits.lastRequest} < ${cutoff} then 1 else ${authRateLimits.count} + 1 end`,
					lastRequest: sql`greatest(${authRateLimits.lastRequest}, ${now})`,
				},
				setWhere: or(
					lt(authRateLimits.lastRequest, cutoff),
					lt(authRateLimits.count, rule.max),
				),
			})
			.returning({ count: authRateLimits.count });

		if (spent) {
			return { allowed: true, retryAfter: null };
		}

		const current = await get(key);
		if (!current || current.lastRequest < cutoff) {
			return consume(key, rule);
		}

		return {
			allowed: false,
			retryAfter: Math.ceil(
				(current.lastRequest + windowMs - Date.now()) / 1000,
			),
		};
	}

	return { get, set, consume };
}
