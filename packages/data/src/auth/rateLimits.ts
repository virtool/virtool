import { sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";

/** A fixed-window budget: at most `max` attempts in `window` seconds. */
export type RateLimitRule = {
	window: number;
	max: number;
};

/** The budgets Virtool keeps in `auth_rate_limits` beside Better Auth's own. */
export type RateLimitBudget = "login" | "recovery" | "step-up";

// The longest window a rule may have, including Better Auth's own per-path
// rules. A row older than this can't affect any budget, so the prune deletes
// it.
const MAX_WINDOW_SECONDS = 60 * 60;

const RATE_LIMIT_RETENTION_MS = MAX_WINDOW_SECONDS * 1000;

const RATE_LIMIT_PRUNE_BATCH_SIZE = 2_000;

// One value per statement, so every use in a statement agrees on whether the
// window ended.
const NOW_MS = sql<number>`floor(extract(epoch from statement_timestamp()) * 1000)`;

/** Build the key of one Virtool budget from its parts. */
export function getRateLimitKey(
	budget: RateLimitBudget,
	...parts: string[]
): string {
	return `virtool:${budget}:${parts.join(":")}`;
}

/**
 * Spend one attempt from a fixed window, and report whether it was allowed.
 *
 * `last_request` holds the start of the window, on Postgres's clock, so every
 * web instance sees the same window. A refused attempt writes nothing, so
 * repeated requests can't extend a window past its end. Every allowed attempt
 * is counted before its caller checks anything, so concurrent attempts can't
 * overrun the budget.
 */
export async function spendRateLimit(
	db: Db,
	key: string,
	rule: RateLimitRule,
): Promise<boolean> {
	if (rule.window > MAX_WINDOW_SECONDS) {
		throw new Error(
			`Rate limit window exceeds ${MAX_WINDOW_SECONDS} seconds and would be pruned early`,
		);
	}

	const windowMs = rule.window * 1000;
	const windowEnded = sql`${authRateLimits.lastRequest} <= ${NOW_MS} - ${windowMs}`;
	const [row] = await db
		.insert(authRateLimits)
		.values({ key, count: 1, lastRequest: NOW_MS })
		.onConflictDoUpdate({
			target: authRateLimits.key,
			set: {
				count: sql`case when ${windowEnded} then 1 else ${authRateLimits.count} + 1 end`,
				lastRequest: sql`case when ${windowEnded} then ${NOW_MS} else ${authRateLimits.lastRequest} end`,
			},
			setWhere: sql`${windowEnded} or ${authRateLimits.count} < ${rule.max}`,
		})
		.returning({ id: authRateLimits.id });
	return row !== undefined;
}

/** Give a budget back, so only failures accumulate once an attempt succeeds. */
export async function clearRateLimit(db: Db, key: string): Promise<void> {
	await db.delete(authRateLimits).where(sql`${authRateLimits.key} = ${key}`);
}

/**
 * Better Auth's rate-limit storage, so its own per-path budgets are shared
 * across web instances and spend from the same fixed windows as Virtool's.
 */
export function createRateLimitStorage(db: Db) {
	async function consume(
		key: string,
		rule: RateLimitRule,
	): Promise<{ allowed: boolean; retryAfter: number | null }> {
		if (await spendRateLimit(db, key, rule)) {
			return { allowed: true, retryAfter: null };
		}

		// Postgres's clock, the one that refused the attempt. A fast web host
		// would otherwise see the window as ended and retry until it really ends.
		const [row] = await db
			.select({
				retryAfterMs:
					sql`${authRateLimits.lastRequest} + ${rule.window * 1000} - ${NOW_MS}`.mapWith(
						Number,
					),
			})
			.from(authRateLimits)
			.where(sql`${authRateLimits.key} = ${key}`);
		const retryAfterMs = row?.retryAfterMs ?? 0;
		// The window ended between the refusal and the read, so a new one opens.
		if (retryAfterMs <= 0) {
			return consume(key, rule);
		}

		return { allowed: false, retryAfter: Math.ceil(retryAfterMs / 1000) };
	}

	return { consume };
}

/** Delete rate-limit rows whose window has ended for every budget. */
export async function pruneAuthRateLimits(
	db: Db,
	signal?: AbortSignal,
): Promise<number> {
	// Postgres's clock, so a fast task host can't delete a row early.
	const cutoff = sql`floor(extract(epoch from clock_timestamp()) * 1000) - ${RATE_LIMIT_RETENTION_MS}`;
	let total = 0;

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(authRateLimits)
			.where(
				sql`${authRateLimits.lastRequest} < ${cutoff} and ${authRateLimits.id} in (
					select id from ${authRateLimits}
					where last_request < ${cutoff}
					limit ${RATE_LIMIT_PRUNE_BATCH_SIZE}
				)`,
			)
			.returning({ id: authRateLimits.id });

		total += deleted.length;

		if (deleted.length < RATE_LIMIT_PRUNE_BATCH_SIZE) {
			return total;
		}
	}
}
