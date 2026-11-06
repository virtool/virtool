import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { checkRecoveryRequestBudget } from "./recoveryRateLimit";

const REQUESTER_KEY = "virtool:recovery:requester:requester";
const TARGET_KEY = "virtool:recovery:target:target";

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

async function spend(requester: string, target = "target"): Promise<boolean> {
	return checkRecoveryRequestBudget(db, requester, target);
}

async function getRow(key: string) {
	const [row] = await db
		.select()
		.from(authRateLimits)
		.where(eq(authRateLimits.key, key));
	return row;
}

async function age(key: string, ms: number): Promise<void> {
	const row = await getRow(key);
	await db
		.update(authRateLimits)
		.set({ lastRequest: (row?.lastRequest ?? 0) - ms })
		.where(eq(authRateLimits.key, key));
}

describe("checkRecoveryRequestBudget", () => {
	it("allows three requests for a target in an hour", async () => {
		expect(await spend("a")).toBe(true);
		expect(await spend("b")).toBe(true);
		expect(await spend("c")).toBe(true);
		expect(await spend("d")).toBe(false);
	});

	it("allows five requests from a requester in a minute", async () => {
		for (const target of ["t1", "t2", "t3", "t4", "t5"]) {
			expect(await spend("requester", target)).toBe(true);
		}
		expect(await spend("requester", "t6")).toBe(false);
	});

	it("does not move the window on a refused request", async () => {
		await spend("a");
		await spend("b");
		await spend("c");
		const before = await getRow(TARGET_KEY);

		expect(await spend("d")).toBe(false);

		expect(await getRow(TARGET_KEY)).toEqual(before);
	});

	it("opens a new window after the first one ends despite refused requests", async () => {
		await spend("a");
		await spend("b");
		await spend("c");
		await age(TARGET_KEY, 59 * 60_000);
		expect(await spend("d")).toBe(false);
		await age(TARGET_KEY, 60_000);

		expect(await spend("e")).toBe(true);

		const row = await getRow(TARGET_KEY);
		expect(row?.count).toBe(1);
		expect(row?.lastRequest).toBeGreaterThan(Date.now() - 60_000);
	});

	it("does not spend the target budget for a refused requester", async () => {
		for (const target of ["t1", "t2", "t3", "t4", "t5"]) {
			await spend("requester", target);
		}

		expect(await spend("requester")).toBe(false);

		expect(await getRow(TARGET_KEY)).toBeUndefined();
		expect((await getRow(REQUESTER_KEY))?.count).toBe(5);
	});

	it("counts concurrent requests exactly", async () => {
		const results = await Promise.all(
			["a", "b", "c", "d", "e", "f"].map((requester) => spend(requester)),
		);

		expect(results.filter(Boolean)).toHaveLength(3);
	});
});
