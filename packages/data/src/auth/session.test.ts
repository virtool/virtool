import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authSessions } from "../db/schema/auth";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { createAuthenticatedSession, deleteExpiredSessions } from "./session";
import { seedSession, seedUser } from "./test/fixtures";

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
	await db.delete(authSessions);
	await db.delete(users);
});

function minutesFromNow(minutes: number): Date {
	return new Date(Date.now() + minutes * 60 * 1000);
}

describe("deleteExpiredSessions", () => {
	it("deletes expired sessions and keeps live sessions", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });
		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		expect(await deleteExpiredSessions(db)).toBe(1);
		expect(await db.select({ id: authSessions.id }).from(authSessions)).toEqual(
			[{ id: live.sessionId }],
		);
	});

	it("sweeps in more than one batch", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });
		await seedSession(db, userId, { expiresAt: minutesFromNow(-1) });

		expect(await deleteExpiredSessions(db, { batchSize: 1 })).toBe(2);
	});

	it("also deletes expired retained legacy sessions", async () => {
		const userId = await seedUser(db);
		const legacy = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		await db
			.update(sessions)
			.set({ expiresAt: minutesFromNow(-1) })
			.where(eq(sessions.id, legacy.row.id));

		expect(await deleteExpiredSessions(db)).toBe(1);
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it("rejects a batch size that is not a positive integer", async () => {
		await expect(
			deleteExpiredSessions(db, { batchSize: 0 }),
		).rejects.toBeInstanceOf(RangeError);
	});
});
