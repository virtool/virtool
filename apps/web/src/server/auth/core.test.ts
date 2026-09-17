import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import {
	seedSession,
	seedSetupSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts, authSessions } from "@virtool/data/db/schema/auth";
import { setupSessions } from "@virtool/data/db/schema/setup";
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
	beginLegacyEmailRemediation,
	createFirstUser,
	FirstUserExistsError,
	InvalidCredentialsError,
	logout,
	PasswordReuseError,
	resetPassword,
} from "./core";

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
	await db.delete(users);
});

function fakeCookies(setupSessionId?: string): CookieAdapter {
	return {
		clearLegacySession: vi.fn(),
		clearSetup: vi.fn(),
		getSetupSessionId: vi.fn(() => setupSessionId),
		getSetupSessionToken: vi.fn(),
		setSetupSession: vi.fn(),
	};
}

async function seedCredentialedUser(forceReset = true): Promise<number> {
	const password = await hashPassword("old-password-123");
	const userId = await seedUser(db, { forceReset, password });
	const now = new Date();
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: password.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});
	return userId;
}

describe("beginLegacyEmailRemediation", () => {
	it("exchanges a valid legacy password for an email-remediation session", async () => {
		const password = await hashPassword("legacy-password-123");
		const userId = await seedUser(db, {
			email: "",
			handle: "LegacyUser",
			password,
		});
		const cookies = fakeCookies();

		await expect(
			beginLegacyEmailRemediation(db, cookies, {
				handle: "legacyuser",
				password: "legacy-password-123",
				ip: "127.0.0.1",
			}),
		).resolves.toBe(true);

		const [session] = await db.select().from(setupSessions);
		expect(session).toMatchObject({
			userId,
			purpose: "email_remediation",
			ip: "127.0.0.1",
		});
		expect(cookies.setSetupSession).toHaveBeenCalledWith(
			session?.sessionId,
			expect.any(String),
		);
	});

	it("refuses the wrong legacy password", async () => {
		const password = await hashPassword("legacy-password-123");
		await seedUser(db, { password });

		await expect(
			beginLegacyEmailRemediation(db, fakeCookies(), {
				handle: "alice",
				password: "wrong-password",
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
	});

	it("leaves migrated identities to Better Auth", async () => {
		const userId = await seedUser(db);
		await db
			.update(users)
			.set({ authMigratedAt: new Date() })
			.where(eq(users.id, userId));

		await expect(
			beginLegacyEmailRemediation(db, fakeCookies(), {
				handle: "alice",
				password: "any-password",
				ip: "127.0.0.1",
			}),
		).resolves.toBe(false);
	});
});

describe("createFirstUser", () => {
	it("creates the full administrator and Better Auth credential", async () => {
		const user = await createFirstUser(db, {
			handle: "alice",
			password: "a-real-password",
		});

		expect(user.administratorRole).toBe("full");
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("refuses a second first user", async () => {
		await seedUser(db);
		await expect(
			createFirstUser(db, { handle: "bob", password: "a-real-password" }),
		).rejects.toBeInstanceOf(FirstUserExistsError);
	});
});

describe("logout", () => {
	it("invalidates setup state and clears setup and obsolete cookies", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const setup = await seedSetupSession(db, userId, "account_completion");
		const cookies = fakeCookies(setup.sessionId);

		await logout(db, cookies);

		expect(await db.select().from(setupSessions)).toHaveLength(0);
		expect(cookies.clearLegacySession).toHaveBeenCalledOnce();
		expect(cookies.clearSetup).toHaveBeenCalledOnce();
	});
});

describe("resetPassword", () => {
	it("updates both password copies and revokes every Better Auth session", async () => {
		const userId = await seedCredentialedUser();
		await seedSession(db, userId);
		await seedSession(db, userId);

		const handle = await resetPassword(db, {
			userId,
			password: "new-password-123",
		});

		const [user] = await db.select().from(users).where(eq(users.id, userId));
		const [credential] = await db
			.select()
			.from(authAccounts)
			.where(eq(authAccounts.userId, userId));
		expect(handle).toBe("alice");
		expect(user?.forceReset).toBe(false);
		expect(
			await verifyPassword("new-password-123", user?.password as Buffer),
		).toBe(true);
		expect(credential?.password).toBe(user?.password?.toString("utf8"));
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	it("refuses password reuse", async () => {
		const userId = await seedCredentialedUser();
		await expect(
			resetPassword(db, { userId, password: "old-password-123" }),
		).rejects.toBeInstanceOf(PasswordReuseError);
	});
});
