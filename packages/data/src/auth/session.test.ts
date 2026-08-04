import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createAuthenticatedSession,
	createResetSession,
	invalidateSession,
	invalidateUserSessions,
} from "./session";
import { seedSession, seedUser } from "./test/fixtures";
import { hashToken } from "./tokens";

// The Python lifetimes in `virtool/sessions/data.py`, which these rows must be
// indistinguishable from.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

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
	await db.delete(sessions);
	await db.delete(users);
});

// `createdAt` and `expiresAt` are both derived from a single `now`, so the gap
// between them is the lifetime exactly — no clock stubbing required.
function lifetimeOf(row: { createdAt: Date; expiresAt: Date }): number {
	return row.expiresAt.getTime() - row.createdAt.getTime();
}

describe("createAuthenticatedSession", () => {
	it("gives a remembered session a thirty day lifetime", async () => {
		const userId = await seedUser(db);

		const { row } = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: true,
		});

		expect(lifetimeOf(row)).toBe(THIRTY_DAYS_MS);
	});

	it("gives an unremembered session a sixty minute lifetime", async () => {
		const userId = await seedUser(db);

		const { row } = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(lifetimeOf(row)).toBe(SIXTY_MINUTES_MS);
	});

	it("writes an authenticated row for the user and ip", async () => {
		const userId = await seedUser(db);

		const { row } = await createAuthenticatedSession(db, {
			userId,
			ip: "10.0.0.4",
			remember: false,
		});

		expect(row.sessionType).toBe("authenticated");
		expect(row.userId).toBe(userId);
		expect(row.ip).toBe("10.0.0.4");
		expect(row.resetCode).toBeNull();
	});

	it("stores only the hash of the token, never the plaintext", async () => {
		const userId = await seedUser(db);

		const { token, row } = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(row.tokenHash).toBe(hashToken(token));
		expect(row.tokenHash).not.toBe(token);
	});

	it("mints a distinct session id and token each time", async () => {
		const userId = await seedUser(db);
		const input = { userId, ip: "127.0.0.1", remember: false };

		const first = await createAuthenticatedSession(db, input);
		const second = await createAuthenticatedSession(db, input);

		expect(first.sessionId).not.toBe(second.sessionId);
		expect(first.token).not.toBe(second.token);
	});
});

describe("createResetSession", () => {
	it("gives a reset session a ten minute lifetime", async () => {
		const userId = await seedUser(db);

		const { row } = await createResetSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(lifetimeOf(row)).toBe(TEN_MINUTES_MS);
	});

	it("writes a reset row with a reset code and no token hash", async () => {
		const userId = await seedUser(db);

		const { resetCode, row } = await createResetSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(row.sessionType).toBe("reset");
		expect(row.userId).toBe(userId);
		expect(row.tokenHash).toBeNull();
		expect(row.resetCode).toBe(resetCode);
		expect(resetCode).toMatch(/^[0-9a-f]{64}$/);
	});

	// `resetPassword` reads `resetRemember` back to carry the flag into the
	// authenticated session it mints. If it were not persisted, a user who ticked
	// "remember me" would silently get a sixty minute session after a reset.
	it.each([true, false])(
		"persists remember=%s across the reset",
		async (remember) => {
			const userId = await seedUser(db);

			const { row } = await createResetSession(db, {
				userId,
				ip: "127.0.0.1",
				remember,
			});

			expect(row.resetRemember).toBe(remember);
		},
	);
});

describe("invalidateSession", () => {
	it("deletes only the named session", async () => {
		const userId = await seedUser(db);
		const doomed = await seedSession(db, userId);
		const kept = await seedSession(db, userId);

		await invalidateSession(db, doomed.sessionId);

		const remaining = await db
			.select({ sessionId: sessions.sessionId })
			.from(sessions);

		expect(remaining).toEqual([{ sessionId: kept.sessionId }]);
	});

	it("is a no-op for an unknown session id", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		await invalidateSession(db, "session_unknown");

		expect(await db.select().from(sessions)).toHaveLength(1);
	});
});

describe("invalidateUserSessions", () => {
	it("deletes every session of one user and leaves other users alone", async () => {
		const alice = await seedUser(db);
		const bob = await seedUser(db, { handle: "bob" });

		await seedSession(db, alice);
		await seedSession(db, alice);
		const bobSession = await seedSession(db, bob);

		await invalidateUserSessions(db, alice);

		const remaining = await db
			.select({ sessionId: sessions.sessionId, userId: sessions.userId })
			.from(sessions);

		expect(remaining).toEqual([
			{ sessionId: bobSession.sessionId, userId: bob },
		]);
	});

	it("leaves the user row itself in place", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId);

		await invalidateUserSessions(db, userId);

		expect(
			await db.select({ id: users.id }).from(users).where(eq(users.id, userId)),
		).toEqual([{ id: userId }]);
	});
});
