import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import * as sessionModule from "@virtool/data/auth/session";
import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { CookieAdapter } from "./cookies";
import {
	createFirstUser,
	FirstUserExistsError,
	InvalidCredentialsError,
	InvalidResetSessionError,
	login,
	logout,
	PasswordReuseError,
	resetPassword,
} from "./core";

// `createAuthenticatedSession` is the third and last write in the reset. Making
// it fail is how we drive the partial failure the transaction has to undo. The
// rest of the module keeps its real behaviour — the other two writes must
// actually hit the database for a rollback to be worth asserting.
vi.mock("@virtool/data/auth/session", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@virtool/data/auth/session")>();
	return {
		...actual,
		createAuthenticatedSession: vi.fn(actual.createAuthenticatedSession),
	};
});

const { createResetSession } = sessionModule;
const createAuthenticatedSession = vi.mocked(
	sessionModule.createAuthenticatedSession,
);

const OLD_PASSWORD = "old-password";
const NEW_PASSWORD = "new-password";

type FakeCookies = CookieAdapter & {
	sessionId: string | undefined;
	token: string | undefined;
};

function fakeCookies(sessionId?: string): FakeCookies {
	return {
		sessionId,
		token: undefined,
		getSessionId() {
			return this.sessionId;
		},
		getSessionToken() {
			return this.token;
		},
		setSessionId(value: string) {
			this.sessionId = value;
		},
		setSessionToken(value: string) {
			this.token = value;
		},
		clear() {
			this.sessionId = undefined;
			this.token = undefined;
		},
	};
}

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
	vi.mocked(createAuthenticatedSession).mockClear();
	await db.delete(sessions);
	await db.delete(users);
});

/** Seed a force-reset user with a real bcrypt hash, plus a live reset session. */
async function seedResetFlow() {
	const userId = await seedUser(db, {
		forceReset: true,
		password: await hashPassword(OLD_PASSWORD),
	});

	const { sessionId, resetCode } = await createResetSession(db, {
		userId,
		ip: "127.0.0.1",
		remember: false,
	});

	return { userId, sessionId, resetCode };
}

function readUser(userId: number) {
	return db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((rows) => rows[0]);
}

describe("resetPassword", () => {
	it("changes the password and sets the session cookies", async () => {
		const { userId, sessionId, resetCode } = await seedResetFlow();
		const cookies = fakeCookies(sessionId);

		await resetPassword(db, cookies, {
			password: NEW_PASSWORD,
			resetCode,
			ip: "127.0.0.1",
		});

		const user = await readUser(userId);
		expect(user).toBeDefined();
		expect(await verifyPassword(NEW_PASSWORD, user?.password as Buffer)).toBe(
			true,
		);
		expect(user?.forceReset).toBe(false);

		// The reset session is gone and an authenticated one took its place.
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionType).toBe("authenticated");

		expect(cookies.sessionId).toBe(rows[0]?.sessionId);
		expect(cookies.token).toBeDefined();
	});

	it("rolls the password back when the session write fails", async () => {
		const { userId, sessionId, resetCode } = await seedResetFlow();
		const before = await readUser(userId);

		// A session the user already holds. It must survive the failed reset —
		// `invalidateUserSessions` runs first and has to be undone too.
		const existing = await seedSession(db, userId);

		const cookies = fakeCookies(sessionId);

		createAuthenticatedSession.mockRejectedValueOnce(
			new Error("session insert failed"),
		);

		await expect(
			resetPassword(db, cookies, {
				password: NEW_PASSWORD,
				resetCode,
				ip: "127.0.0.1",
			}),
		).rejects.toThrow("session insert failed");

		// The password is untouched: the old one still works, the new one does not.
		const after = await readUser(userId);
		expect(await verifyPassword(OLD_PASSWORD, after?.password as Buffer)).toBe(
			true,
		);
		expect(await verifyPassword(NEW_PASSWORD, after?.password as Buffer)).toBe(
			false,
		);
		expect(after?.forceReset).toBe(true);
		expect(after?.lastPasswordChange).toEqual(before?.lastPasswordChange);

		// The session deletion rolled back with it.
		const surviving = await db
			.select()
			.from(sessions)
			.where(eq(sessions.sessionId, existing.sessionId));
		expect(surviving).toHaveLength(1);

		// And the browser was told nothing.
		expect(cookies.sessionId).toBe(sessionId);
		expect(cookies.token).toBeUndefined();
	});

	it("lets only one of two concurrent resets for the same code win", async () => {
		const { userId, sessionId, resetCode } = await seedResetFlow();

		const first = fakeCookies(sessionId);
		const second = fakeCookies(sessionId);

		// A double-clicked submit. Both pass validation and the reuse check before
		// either commits — neither has written yet, so both still read the old hash.
		const results = await Promise.allSettled([
			resetPassword(db, first, {
				password: NEW_PASSWORD,
				resetCode,
				ip: "127.0.0.1",
			}),
			resetPassword(db, second, {
				password: NEW_PASSWORD,
				resetCode,
				ip: "127.0.0.1",
			}),
		]);

		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter((r) => r.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
			InvalidResetSessionError,
		);

		// The loser rolled back rather than deleting the winner's session, so the
		// one surviving session is the one whose cookies the winner was handed.
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionType).toBe("authenticated");

		const winner = [first, second].find((c) => c.token !== undefined);
		expect(winner?.sessionId).toBe(rows[0]?.sessionId);
	});

	it("rejects a password matching the current one", async () => {
		const { userId, sessionId, resetCode } = await seedResetFlow();
		const cookies = fakeCookies(sessionId);

		await expect(
			resetPassword(db, cookies, {
				password: OLD_PASSWORD,
				resetCode,
				ip: "127.0.0.1",
			}),
		).rejects.toThrow(PasswordReuseError);

		expect(createAuthenticatedSession).not.toHaveBeenCalled();

		const user = await readUser(userId);
		expect(user?.forceReset).toBe(true);
	});

	it("rejects a wrong reset code and burns the session", async () => {
		const { userId, sessionId, resetCode } = await seedResetFlow();
		const cookies = fakeCookies(sessionId);

		await expect(
			resetPassword(db, cookies, {
				password: NEW_PASSWORD,
				resetCode: "0".repeat(resetCode.length),
				ip: "127.0.0.1",
			}),
		).rejects.toThrow(InvalidResetSessionError);

		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));
		expect(rows).toHaveLength(0);

		const user = await readUser(userId);
		expect(await verifyPassword(OLD_PASSWORD, user?.password as Buffer)).toBe(
			true,
		);
	});

	it("rejects when there is no session cookie", async () => {
		await seedResetFlow();

		await expect(
			resetPassword(db, fakeCookies(), {
				password: NEW_PASSWORD,
				resetCode: "whatever",
				ip: "127.0.0.1",
			}),
		).rejects.toThrow(InvalidResetSessionError);
	});
});

describe("createFirstUser", () => {
	it("creates a full-administrator user and signs them in", async () => {
		const cookies = fakeCookies();

		const user = await createFirstUser(db, cookies, {
			handle: "root",
			password: "a-real-password",
			ip: "127.0.0.1",
		});

		expect(user.handle).toBe("root");
		expect(user.administratorRole).toBe("full");

		// The caller lands in the app: an authenticated session and both cookies.
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, user.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionType).toBe("authenticated");
		expect(cookies.sessionId).toBe(rows[0]?.sessionId);
		expect(cookies.token).toBeDefined();
	});

	it("refuses once any user exists", async () => {
		await seedUser(db, { handle: "existing" });
		const cookies = fakeCookies();

		await expect(
			createFirstUser(db, cookies, {
				handle: "root",
				password: "a-real-password",
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(FirstUserExistsError);
		expect(cookies.token).toBeUndefined();
	});
});

describe("login", () => {
	it("authenticates a valid credential and sets both cookies", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			password: await hashPassword(OLD_PASSWORD),
		});
		const cookies = fakeCookies();

		const result = await login(db, cookies, {
			handle: "alice",
			password: OLD_PASSWORD,
			remember: false,
			ip: "127.0.0.1",
		});

		expect(result).toEqual({ status: "authenticated" });
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionType).toBe("authenticated");
		expect(cookies.sessionId).toBe(rows[0]?.sessionId);
		expect(cookies.token).toBeDefined();
	});

	it("matches the handle case-insensitively", async () => {
		await seedUser(db, {
			handle: "alice",
			password: await hashPassword(OLD_PASSWORD),
		});
		const cookies = fakeCookies();

		const result = await login(db, cookies, {
			handle: "ALICE",
			password: OLD_PASSWORD,
			remember: false,
			ip: "127.0.0.1",
		});

		expect(result).toEqual({ status: "authenticated" });
	});

	it("rejects a wrong password without creating a session", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			password: await hashPassword(OLD_PASSWORD),
		});
		const cookies = fakeCookies();

		await expect(
			login(db, cookies, {
				handle: "alice",
				password: "wrong-password",
				remember: false,
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(
			await db.select().from(sessions).where(eq(sessions.userId, userId)),
		).toHaveLength(0);
		expect(cookies.sessionId).toBeUndefined();
	});

	it("rejects an unknown handle", async () => {
		const cookies = fakeCookies();

		await expect(
			login(db, cookies, {
				handle: "nobody",
				password: OLD_PASSWORD,
				remember: false,
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("rejects an inactive user", async () => {
		await seedUser(db, {
			handle: "alice",
			active: false,
			password: await hashPassword(OLD_PASSWORD),
		});
		const cookies = fakeCookies();

		await expect(
			login(db, cookies, {
				handle: "alice",
				password: OLD_PASSWORD,
				remember: false,
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("defers a force-reset user to /reset instead of authenticating", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			forceReset: true,
			password: await hashPassword(OLD_PASSWORD),
		});
		const cookies = fakeCookies();

		const result = await login(db, cookies, {
			handle: "alice",
			password: OLD_PASSWORD,
			remember: false,
			ip: "127.0.0.1",
		});

		expect(result.status).toBe("reset_required");
		// A reset session is set, but no token cookie — the reset is not yet a login.
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionType).toBe("reset");
		expect(cookies.sessionId).toBe(rows[0]?.sessionId);
		expect(cookies.token).toBeUndefined();
	});
});

describe("logout", () => {
	it("invalidates the session and clears the cookies", async () => {
		const userId = await seedUser(db);
		const { sessionId } = await seedSession(db, userId);
		const cookies = fakeCookies(sessionId);

		await logout(db, cookies);

		expect(
			await db.select().from(sessions).where(eq(sessions.sessionId, sessionId)),
		).toHaveLength(0);
		expect(cookies.sessionId).toBeUndefined();
		expect(cookies.token).toBeUndefined();
	});

	it("still clears the cookies when there is no session", async () => {
		const cookies = fakeCookies();

		await logout(db, cookies);

		expect(cookies.sessionId).toBeUndefined();
	});
});
