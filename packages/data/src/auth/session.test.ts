import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authSessions } from "../db/schema/auth";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createAuthenticatedSession,
	deleteActiveBrowserSession,
	deleteExpiredSessions,
	deleteOtherBrowserSessions,
	findActiveBrowserSessions,
	resolveBrowserSession,
} from "./session";
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

describe("resolveBrowserSession", () => {
	it("reads a live session without changing its expiry", async () => {
		const userId = await seedUser(db);
		const expiresAt = minutesFromNow(30);
		const session = await seedSession(db, userId, { expiresAt });
		expect(
			await resolveBrowserSession(db, session.sessionId, userId),
		).toMatchObject({ userId });
		expect((await db.select().from(authSessions))[0]?.expiresAt).toEqual(
			expiresAt,
		);
	});

	it("rejects expired sessions and deactivated users", async () => {
		const userId = await seedUser(db);
		const expired = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-1),
		});
		expect(
			await resolveBrowserSession(db, expired.sessionId, userId),
		).toBeNull();
		const live = await seedSession(db, userId);
		await db.update(users).set({ active: false }).where(eq(users.id, userId));
		expect(await resolveBrowserSession(db, live.sessionId, userId)).toBeNull();
	});
});

describe("active browser sessions", () => {
	it("lists only the user's live sessions with current first and stable ordering", async () => {
		const userId = await seedUser(db);
		const otherUserId = await seedUser(db, { handle: "bob" });
		const current = await seedSession(db, userId, {
			updatedAt: minutesFromNow(-20),
		});
		const olderId = await seedSession(db, userId, {
			updatedAt: minutesFromNow(-10),
		});
		const newerId = await seedSession(db, userId, {
			updatedAt: minutesFromNow(-5),
		});
		await seedSession(db, userId, { expiresAt: minutesFromNow(-1) });
		await seedSession(db, otherUserId);

		const sessions = await findActiveBrowserSessions(
			db,
			userId,
			current.sessionId,
		);

		expect(sessions.map(({ id }) => id)).toEqual([
			current.sessionId,
			newerId.sessionId,
			olderId.sessionId,
		]);
		expect(sessions[0]).toMatchObject({
			ipAddress: "127.0.0.1",
			userAgent: "Test Browser/1.0",
		});
		expect(sessions[0]).not.toHaveProperty("token");
	});

	it("revokes only a live session owned by the user", async () => {
		const userId = await seedUser(db);
		const otherUserId = await seedUser(db, { handle: "bob" });
		const owned = await seedSession(db, userId);
		const expired = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-1),
		});
		const foreign = await seedSession(db, otherUserId);

		expect(await deleteActiveBrowserSession(db, userId, owned.sessionId)).toBe(
			true,
		);
		expect(await deleteActiveBrowserSession(db, userId, owned.sessionId)).toBe(
			false,
		);
		expect(
			await deleteActiveBrowserSession(db, userId, expired.sessionId),
		).toBe(false);
		expect(
			await deleteActiveBrowserSession(db, userId, foreign.sessionId),
		).toBe(false);
		expect(await db.select({ id: authSessions.id }).from(authSessions)).toEqual(
			expect.arrayContaining([
				{ id: expired.sessionId },
				{ id: foreign.sessionId },
			]),
		);
	});

	it("revokes every other session and preserves exactly the current one", async () => {
		const userId = await seedUser(db);
		const current = await seedSession(db, userId);
		await seedSession(db, userId);
		await seedSession(db, userId);

		expect(
			await deleteOtherBrowserSessions(db, userId, current.sessionId),
		).toBe(2);
		expect(await db.select({ id: authSessions.id }).from(authSessions)).toEqual(
			[{ id: current.sessionId }],
		);
	});

	it("spares a replacement being issued for the current session", async () => {
		const userId = await seedUser(db);
		const current = await seedSession(db, userId);
		const replacement = await seedSession(db, userId);
		await db
			.update(authSessions)
			.set({ replacementForSessionId: current.sessionId })
			.where(eq(authSessions.id, replacement.sessionId));
		await seedSession(db, userId);

		expect(
			await deleteOtherBrowserSessions(db, userId, current.sessionId),
		).toBe(1);
		expect(
			(await db.select({ id: authSessions.id }).from(authSessions)).map(
				({ id }) => id,
			),
		).toEqual([current.sessionId, replacement.sessionId]);
	});

	it("converges when two callers revoke the same session", async () => {
		const userId = await seedUser(db);
		const target = await seedSession(db, userId);
		const first = database.connect();
		const second = database.connect();

		try {
			const results = await Promise.all([
				deleteActiveBrowserSession(first.db, userId, target.sessionId),
				deleteActiveBrowserSession(second.db, userId, target.sessionId),
			]);
			expect(results.sort()).toEqual([false, true]);
		} finally {
			await Promise.all([first.close(), second.close()]);
		}
	});
});

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

	it("treats the effective expiry boundary as inclusive", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});
		await db
			.update(authSessions)
			.set({
				expiresAt: sql`timezone('utc', clock_timestamp())`,
			})
			.where(eq(authSessions.id, session.sessionId));

		expect(await deleteExpiredSessions(db)).toBe(1);
	});

	it("spares a candidate refreshed while cleanup waits on its lock", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-1),
		});
		const holder = database.connect();
		const observer = database.connect();
		const refreshedExpiry = minutesFromNow(30).toISOString();
		let releaseLock = () => {};
		const release = new Promise<void>((resolve) => {
			releaseLock = resolve;
		});
		let reportLocked = () => {};
		const locked = new Promise<void>((resolve) => {
			reportLocked = resolve;
		});

		try {
			const transaction = holder.client.begin(async (tx) => {
				await tx`select id from auth_sessions where id = ${session.sessionId} for update`;
				reportLocked();
				await release;
				await tx`update auth_sessions set expires_at = ${refreshedExpiry}::timestamp where id = ${session.sessionId}`;
			});
			await locked;

			const cleanup = deleteExpiredSessions(db);
			let isWaiting = false;
			for (let attempt = 0; attempt < 100; attempt += 1) {
				const rows = await observer.client<
					{ wait_event_type: string | null }[]
				>`
					select wait_event_type
					from pg_stat_activity
					where datname = current_database()
						and query like 'delete from "auth_sessions"%'
						and wait_event_type = 'Lock'
				`;
				if (rows.length > 0) {
					isWaiting = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			expect(isWaiting).toBe(true);

			releaseLock();
			await transaction;
			expect(await cleanup).toBe(0);
		} finally {
			releaseLock();
			await Promise.all([holder.close(), observer.close()]);
		}
	});

	it("rejects a batch size that is not a positive integer", async () => {
		await expect(
			deleteExpiredSessions(db, { batchSize: 0 }),
		).rejects.toBeInstanceOf(RangeError);
	});

	it("honors cancellation between batches", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			deleteExpiredSessions(db, { signal: controller.signal }),
		).rejects.toEqual(controller.signal.reason);
	});
});
