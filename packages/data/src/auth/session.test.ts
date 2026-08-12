import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
} from "vitest";

import type { Db } from "../db/pg";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createAuthenticatedSession,
	createResetSession,
	deleteExpiredSessions,
	invalidateSession,
	invalidateUserSessions,
} from "./session";
import { seedSession, seedUser } from "./test/fixtures";
import { hashToken } from "./tokens";

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

describe("deleteExpiredSessions", () => {
	const FIVE_MINUTES_MS = 5 * 60 * 1000;

	function minutesFromNow(minutes: number): Date {
		return new Date(Date.now() + minutes * 60 * 1000);
	}

	async function remainingSessionIds(): Promise<string[]> {
		const rows = await db
			.select({ sessionId: sessions.sessionId })
			.from(sessions)
			.orderBy(sessions.id);

		return rows.map((row) => row.sessionId);
	}

	it("deletes an expired session and leaves a live one", async () => {
		const userId = await seedUser(db);

		await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });
		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		expect(await deleteExpiredSessions(db)).toBe(1);
		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});

	// `expires_at` is `timestamp without time zone` holding naive UTC. A cutoff
	// bound as a `Date` casts through the session `TimeZone`, which is unset here,
	// so a wrong cutoff is out by whole hours rather than by seconds. Five minutes
	// either side of now catches that in both directions: an hour early would keep
	// the expired row, an hour late would take the live one.
	it("puts the cutoff at now, not an hour either side of it", async () => {
		const userId = await seedUser(db);

		await seedSession(db, userId, {
			expiresAt: new Date(Date.now() - FIVE_MINUTES_MS),
		});
		const live = await seedSession(db, userId, {
			expiresAt: new Date(Date.now() + FIVE_MINUTES_MS),
		});

		expect(await deleteExpiredSessions(db)).toBe(1);
		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});

	it("deletes every session type", async () => {
		const userId = await seedUser(db);

		for (const sessionType of [
			"anonymous",
			"authenticated",
			"reset",
		] as const) {
			await seedSession(db, userId, {
				expiresAt: minutesFromNow(-30),
				sessionType,
			});
		}

		expect(await deleteExpiredSessions(db)).toBe(3);
		expect(await remainingSessionIds()).toEqual([]);
	});

	it("loops past the batch size until nothing expired is left", async () => {
		const userId = await seedUser(db);

		for (let index = 0; index < 7; index++) {
			await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });
		}

		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		expect(await deleteExpiredSessions(db, { batchSize: 2 })).toBe(7);
		expect(await remainingSessionIds()).toEqual([live.sessionId]);
	});

	it("returns zero when nothing has expired", async () => {
		const userId = await seedUser(db);
		await seedSession(db, userId, { expiresAt: minutesFromNow(30) });

		expect(await deleteExpiredSessions(db)).toBe(0);
		expect(await remainingSessionIds()).toHaveLength(1);
	});

	// Deleting a live session logs a user out early, which is the only harm this
	// can do — so the surviving row is compared whole rather than counted.
	it("leaves a live session's row untouched", async () => {
		const userId = await seedUser(db);

		const live = await seedSession(db, userId, {
			expiresAt: minutesFromNow(30),
		});

		const before = await db
			.select()
			.from(sessions)
			.where(eq(sessions.sessionId, live.sessionId));

		await seedSession(db, userId, { expiresAt: minutesFromNow(-30) });

		await deleteExpiredSessions(db);

		expect(
			await db
				.select()
				.from(sessions)
				.where(eq(sessions.sessionId, live.sessionId)),
		).toEqual(before);
	});

	/**
	 * The refresh race the outer `where`'s repeated expiry test exists for.
	 *
	 * A second session extends the row and holds its lock, so the delete's
	 * subquery still sees it expired and the delete itself parks on the lock.
	 * Once that commits, Postgres re-checks the outer predicate alone — a
	 * predicate naming only the id would pass, and the refreshed session would
	 * go.
	 */
	it("spares a session refreshed between the select and the delete", async () => {
		const refresher = database.connect();
		const observer = database.connect();

		onTestFinished(async () => {
			await Promise.all([refresher.close(), observer.close()]);
		});

		const userId = await seedUser(db);
		const refreshed = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-30),
		});

		let commit: () => void = () => undefined;
		const committed = new Promise<void>((resolve) => {
			commit = resolve;
		});

		let extended: () => void = () => undefined;
		const holds = new Promise<void>((resolve) => {
			extended = resolve;
		});

		const holding = refresher.client.begin(async (tx) => {
			await tx`
				update sessions
				set expires_at = timezone('utc', clock_timestamp()) + interval '30 minutes'
				where session_id = ${refreshed.sessionId}
			`;

			extended();

			await committed;
		});

		await holds;

		const deleting = deleteExpiredSessions(db);

		for (let attempt = 0; attempt < 100; attempt++) {
			const rows = await observer.client.unsafe(
				`select 1 from pg_stat_activity
				 where datname = current_database() and wait_event_type = 'Lock'`,
			);

			if (rows.length > 0) {
				break;
			}

			await delay(25);
		}

		commit();
		await holding;

		expect(await deleting).toBe(0);
		expect(await remainingSessionIds()).toEqual([refreshed.sessionId]);
	}, 15_000);

	it("rejects a batch size that would never advance the loop", async () => {
		await expect(deleteExpiredSessions(db, { batchSize: 0 })).rejects.toThrow(
			RangeError,
		);
	});

	// The signal is checked between batches, so a run on a table that has never
	// been cleared cannot outlive the drain. Whatever earlier batches committed
	// stands: each is its own transaction.
	it("throws and deletes nothing when the signal is already aborted", async () => {
		const userId = await seedUser(db);
		const expired = await seedSession(db, userId, {
			expiresAt: minutesFromNow(-30),
		});

		await expect(
			deleteExpiredSessions(db, { signal: AbortSignal.abort() }),
		).rejects.toThrow();

		expect(await remainingSessionIds()).toEqual([expired.sessionId]);
	});
});
