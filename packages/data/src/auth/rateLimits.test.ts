import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	clearRateLimit,
	createRateLimitStorage,
	getRateLimitKey,
	pruneAuthRateLimits,
	spendRateLimit,
} from "./rateLimits";

const KEY = getRateLimitKey("login", "username", "digest");
const RULE = { window: 60, max: 3 };

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database ??= await createTestDatabase();
	db = database.db;
	await db.delete(authRateLimits);
}, 60_000);

afterAll(async () => {
	await database?.drop();
});

async function getRow(key = KEY) {
	const [row] = await db
		.select()
		.from(authRateLimits)
		.where(eq(authRateLimits.key, key));
	return row;
}

async function age(ms: number, key = KEY): Promise<void> {
	const row = await getRow(key);
	await db
		.update(authRateLimits)
		.set({ lastRequest: (row?.lastRequest ?? 0) - ms })
		.where(eq(authRateLimits.key, key));
}

describe("getRateLimitKey", () => {
	it("namespaces a budget under the virtool prefix", () => {
		expect(getRateLimitKey("step-up", "user", "7")).toBe(
			"virtool:step-up:user:7",
		);
	});
});

describe("spendRateLimit", () => {
	it("allows max attempts in a window and refuses the next", async () => {
		expect(await spendRateLimit(db, KEY, RULE)).toBe(true);
		expect(await spendRateLimit(db, KEY, RULE)).toBe(true);
		expect(await spendRateLimit(db, KEY, RULE)).toBe(true);
		expect(await spendRateLimit(db, KEY, RULE)).toBe(false);
	});

	it("writes nothing for a refused attempt", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await spendRateLimit(db, KEY, RULE);
		}
		const before = await getRow();

		expect(await spendRateLimit(db, KEY, RULE)).toBe(false);

		expect(await getRow()).toEqual(before);
	});

	it("keeps the window start when an attempt is allowed", async () => {
		await spendRateLimit(db, KEY, RULE);
		await age(30_000);
		const before = await getRow();

		await spendRateLimit(db, KEY, RULE);

		expect(await getRow()).toEqual({ ...before, count: 2 });
	});

	it("opens a new window after the first one ends despite refused attempts", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await spendRateLimit(db, KEY, RULE);
		}
		await age(59_000);
		expect(await spendRateLimit(db, KEY, RULE)).toBe(false);
		await age(1_000);

		expect(await spendRateLimit(db, KEY, RULE)).toBe(true);

		const row = await getRow();
		expect(row?.count).toBe(1);
		expect(row?.lastRequest).toBeGreaterThan(Date.now() - 10_000);
	});

	it("counts concurrent attempts exactly", async () => {
		const results = await Promise.all(
			Array.from({ length: 6 }, () => spendRateLimit(db, KEY, RULE)),
		);

		expect(results.filter(Boolean)).toHaveLength(3);
	});

	it("refuses a window the prune would cut short", async () => {
		await expect(
			spendRateLimit(db, KEY, { window: 60 * 60 + 1, max: 1 }),
		).rejects.toThrow("Rate limit window exceeds");
	});
});

describe("clearRateLimit", () => {
	it("gives the budget back", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await spendRateLimit(db, KEY, RULE);
		}

		await clearRateLimit(db, KEY);

		expect(await getRow()).toBeUndefined();
		expect(await spendRateLimit(db, KEY, RULE)).toBe(true);
	});

	it("does nothing for an unknown key", async () => {
		await expect(clearRateLimit(db, KEY)).resolves.toBeUndefined();
	});
});

describe("createRateLimitStorage", () => {
	it("spends Better Auth budgets from the same fixed window", async () => {
		const storage = createRateLimitStorage(db);
		const key = "203.0.113.1|/sign-in";

		for (let attempt = 0; attempt < 3; attempt++) {
			expect(await storage.consume(key, RULE)).toEqual({
				allowed: true,
				retryAfter: null,
			});
		}

		const refused = await storage.consume(key, RULE);
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfter).toBeGreaterThan(0);
		expect(refused.retryAfter).toBeLessThanOrEqual(RULE.window);
		expect((await getRow(key))?.count).toBe(3);
	});

	it("refuses at once when the web host's clock is past the window", async () => {
		const storage = createRateLimitStorage(db);
		const key = "203.0.113.1|/sign-in";
		for (let attempt = 0; attempt < 3; attempt++) {
			await storage.consume(key, RULE);
		}

		const now = vi
			.spyOn(Date, "now")
			.mockReturnValue(Date.now() + 2 * RULE.window * 1000);
		try {
			const refused = await storage.consume(key, RULE);
			expect(refused.allowed).toBe(false);
			expect(refused.retryAfter).toBeGreaterThan(0);
			expect(refused.retryAfter).toBeLessThanOrEqual(RULE.window);
		} finally {
			now.mockRestore();
		}
	});

	it("opens a new window once the old one ends", async () => {
		const storage = createRateLimitStorage(db);
		const key = "203.0.113.1|/sign-in";
		for (let attempt = 0; attempt < 3; attempt++) {
			await storage.consume(key, RULE);
		}
		await age(60_000, key);

		expect(await storage.consume(key, RULE)).toEqual({
			allowed: true,
			retryAfter: null,
		});
		expect((await getRow(key))?.count).toBe(1);
	});
});

describe("pruneAuthRateLimits", () => {
	it("deletes only rows older than the longest window", async () => {
		const stale = getRateLimitKey("recovery", "target", "stale");
		await spendRateLimit(db, KEY, RULE);
		await spendRateLimit(db, stale, RULE);
		await age(60 * 60_000 + 1_000, stale);

		expect(await pruneAuthRateLimits(db)).toBe(1);

		expect(await getRow()).toBeDefined();
		expect(await getRow(stale)).toBeUndefined();
	});
});
