import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authVerifications } from "../db/schema/auth";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { deleteExpiredVerifications } from "./verifications";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(authVerifications);
});

function minutesFromNow(minutes: number): Date {
	return new Date(Date.now() + minutes * 60 * 1000);
}

async function seedVerification(
	identifier: string,
	expiresAt: Date,
): Promise<number> {
	const now = new Date();
	const [row] = await db
		.insert(authVerifications)
		.values({
			identifier,
			value: "value",
			expiresAt,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: authVerifications.id });

	if (!row) {
		throw new Error("verification insert returned no row");
	}

	return row.id;
}

describe("deleteExpiredVerifications", () => {
	it("deletes expired rows and keeps rows that have not expired", async () => {
		await seedVerification("passkey-challenge", minutesFromNow(-1));
		await seedVerification("trust-device-expired", minutesFromNow(-60));
		const live = await seedVerification("passkey-live", minutesFromNow(5));

		expect(await deleteExpiredVerifications(db)).toBe(2);
		expect(
			await db.select({ id: authVerifications.id }).from(authVerifications),
		).toEqual([{ id: live }]);
	});

	it("sweeps in more than one batch", async () => {
		await seedVerification("first", minutesFromNow(-30));
		await seedVerification("second", minutesFromNow(-1));

		expect(await deleteExpiredVerifications(db, { batchSize: 1 })).toBe(2);
		expect(await db.select().from(authVerifications)).toEqual([]);
	});

	it("rejects a batch size that is not a positive integer", async () => {
		await expect(
			deleteExpiredVerifications(db, { batchSize: 0 }),
		).rejects.toThrow(RangeError);
	});
});
