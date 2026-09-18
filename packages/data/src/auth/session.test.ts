import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authSessions } from "../db/schema/auth";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createAuthenticatedSession,
	createBrowserSessionTiming,
	deleteExpiredSessions,
	refreshBrowserSessionActivity,
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

const timingConfig = {
	idleLifetimeSeconds: 3_600,
	absoluteLifetimeSeconds: 86_400,
	minimumRefreshIntervalSeconds: 300,
};

describe("browser session timing", () => {
	it("derives a new idle deadline and absolute cap from one instant", async () => {
		const timing = await createBrowserSessionTiming(db, timingConfig);

		expect(timing.expiresAt.getTime() - timing.lastActivityAt.getTime()).toBe(
			3_600_000,
		);
		expect(
			timing.absoluteExpiresAt.getTime() - timing.lastActivityAt.getTime(),
		).toBe(86_400_000);
		expect(timing.lastRefreshedAt).toEqual(timing.lastActivityAt);
	});

	it("keeps activity read-only before the minimum refresh interval", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(90),
		});

		const result = await refreshBrowserSessionActivity(
			db,
			session.sessionId,
			userId,
			timingConfig,
		);

		expect(result.status).toBe("not_due");
	});

	it("refreshes a due session without moving its absolute cap", async () => {
		const userId = await seedUser(db);
		const absoluteExpiresAt = minutesFromNow(30);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(10),
			absoluteExpiresAt,
			lastRefreshedAt: minutesFromNow(-10),
		});

		const result = await refreshBrowserSessionActivity(
			db,
			session.sessionId,
			userId,
			timingConfig,
		);

		expect(result).toMatchObject({ status: "refreshed" });
		if (result.status === "refreshed") {
			expect(result.timing.expiresAt).toEqual(absoluteExpiresAt);
			expect(result.timing.absoluteExpiresAt).toEqual(absoluteExpiresAt);
		}
	});

	it("allows at most one concurrent due refresh write", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(90),
			lastRefreshedAt: minutesFromNow(-10),
		});

		const results = await Promise.all(
			Array.from({ length: 4 }, () =>
				refreshBrowserSessionActivity(
					db,
					session.sessionId,
					userId,
					timingConfig,
				),
			),
		);

		expect(results.filter(({ status }) => status === "refreshed")).toHaveLength(
			1,
		);
		expect(results.every(({ status }) => status !== "no_longer_valid")).toBe(
			true,
		);
	});

	it("does not revive an expired or deactivated session", async () => {
		const userId = await seedUser(db);
		const expired = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-1),
			absoluteExpiresAt: minutesFromNow(30),
			lastRefreshedAt: minutesFromNow(-10),
		});

		expect(
			await refreshBrowserSessionActivity(
				db,
				expired.sessionId,
				userId,
				timingConfig,
			),
		).toEqual({ status: "no_longer_valid" });

		const capped = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(-1),
			lastRefreshedAt: minutesFromNow(-10),
		});
		expect(
			await refreshBrowserSessionActivity(
				db,
				capped.sessionId,
				userId,
				timingConfig,
			),
		).toEqual({ status: "no_longer_valid" });

		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(90),
			lastRefreshedAt: minutesFromNow(-10),
		});
		await db.update(users).set({ active: false }).where(eq(users.id, userId));

		expect(await resolveBrowserSession(db, live.sessionId, userId)).toBeNull();
		expect(
			await refreshBrowserSessionActivity(
				db,
				live.sessionId,
				userId,
				timingConfig,
			),
		).toEqual({ status: "no_longer_valid" });
	});

	it("uses the same UTC boundaries under a non-UTC connection timezone", async () => {
		await db.execute(sql`set time zone 'America/Vancouver'`);
		try {
			const timing = await createBrowserSessionTiming(db, timingConfig);
			expect(timing.expiresAt.getTime() - timing.lastActivityAt.getTime()).toBe(
				3_600_000,
			);
		} finally {
			await db.execute(sql`set time zone 'UTC'`);
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

	it("deletes a session whose absolute cap passed independently", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(-1),
		});

		expect(await deleteExpiredSessions(db)).toBe(1);
	});

	it("treats the effective expiry boundary as inclusive", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
			absoluteExpiresAt: minutesFromNow(60),
		});
		await db
			.update(authSessions)
			.set({
				expiresAt: sql`timezone('utc', clock_timestamp())`,
				idleExpiresAt: sql`timezone('utc', clock_timestamp())`,
			})
			.where(eq(authSessions.id, session.sessionId));

		expect(await deleteExpiredSessions(db)).toBe(1);
	});

	it("spares a candidate refreshed while cleanup waits on its lock", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-1),
			absoluteExpiresAt: minutesFromNow(60),
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
				await tx`update auth_sessions set expires_at = ${refreshedExpiry}::timestamp, idle_expires_at = ${refreshedExpiry}::timestamp where id = ${session.sessionId}`;
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
