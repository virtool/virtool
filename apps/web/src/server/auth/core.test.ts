import { hashPassword } from "@virtool/data/auth/password";
import { seedSetupSession, seedUser } from "@virtool/data/auth/test/fixtures";
import { createKeyring } from "@virtool/data/crypto/keyring";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts } from "@virtool/data/db/schema/auth";
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
import { getReleaseDate } from "../changelog/release";
import type { CookieAdapter } from "./cookies";
import {
	createFirstUser,
	FirstUserExistsError,
	InvalidCredentialsError,
	loginLegacyIdentity,
	logout,
} from "./core";

const keyring = createKeyring(undefined, undefined);

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
		clearSetup: vi.fn(),
		getSetupSessionId: vi.fn(() => setupSessionId),
		getSetupSessionToken: vi.fn(),
		setSetupSession: vi.fn(),
	};
}

describe("loginLegacyIdentity", () => {
	it("exchanges a valid unmigrated password for a remediation session", async () => {
		const password = await hashPassword("legacy-password-123");
		const userId = await seedUser(db, {
			email: "",
			handle: "LegacyUser",
			password,
		});
		const cookies = fakeCookies();

		await expect(
			loginLegacyIdentity(db, cookies, {
				handle: "legacyuser",
				password: "legacy-password-123",
				ip: "127.0.0.1",
			}),
		).resolves.toEqual({ remediation: true });

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
			loginLegacyIdentity(db, fakeCookies(), {
				handle: "alice",
				password: "wrong-password",
				ip: "127.0.0.1",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it.each(["invalid-handle", "invalid-password"] as const)(
		"generically refuses an ineligible legacy identity with %s",
		async (reason) => {
			const identity =
				reason === "invalid-handle"
					? {
							handle: "bad handle",
							password: await hashPassword("legacy-password-123"),
						}
					: { handle: "alice", password: Buffer.from("not-bcrypt") };
			await seedUser(db, identity);

			await expect(
				loginLegacyIdentity(db, fakeCookies(), {
					handle: identity.handle,
					password: "legacy-password-123",
					ip: "127.0.0.1",
				}),
			).rejects.toBeInstanceOf(InvalidCredentialsError);
			expect(await db.select().from(setupSessions)).toHaveLength(0);
		},
	);

	it("sends an unmigrated user to email remediation", async () => {
		const password = await hashPassword("legacy-password-123");
		const userId = await seedUser(db, { password });
		const cookies = fakeCookies();

		await expect(
			loginLegacyIdentity(db, cookies, {
				handle: "alice",
				password: "legacy-password-123",
				ip: "127.0.0.1",
			}),
		).resolves.toEqual({ remediation: true });

		const [session] = await db.select().from(setupSessions);
		expect(session).toMatchObject({ userId, purpose: "email_remediation" });
	});

	it("leaves migrated identities to Better Auth", async () => {
		const userId = await seedUser(db);
		await db
			.update(users)
			.set({ authMigratedAt: new Date() })
			.where(eq(users.id, userId));

		await expect(
			loginLegacyIdentity(db, fakeCookies(), {
				handle: "alice",
				password: "any-password",
				ip: "127.0.0.1",
			}),
		).resolves.toBeNull();
	});
});

describe("createFirstUser", () => {
	it("creates the full administrator and Better Auth credential", async () => {
		const result = await createFirstUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: "a-real-password",
			deliveryAvailable: false,
			keyring,
			getVerificationUrl: () => "https://virtool.test/verify-email",
		});

		expect(result.user.administratorRole).toBe("full");
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("starts the watermark at this build's release date", async () => {
		const { user } = await createFirstUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: "a-real-password",
			deliveryAvailable: false,
			keyring,
			getVerificationUrl: () => "https://virtool.test/verify-email",
		});

		const [row] = await db
			.select({ lastSeenChangelogAt: users.lastSeenChangelogAt })
			.from(users)
			.where(eq(users.id, user.id));
		expect(row?.lastSeenChangelogAt).toEqual(getReleaseDate());
	});

	it("refuses a second first user", async () => {
		await seedUser(db);
		await expect(
			createFirstUser(db, {
				handle: "bob",
				email: "bob@example.com",
				password: "a-real-password",
				deliveryAvailable: false,
				keyring,
				getVerificationUrl: () => "https://virtool.test/verify-email",
			}),
		).rejects.toBeInstanceOf(FirstUserExistsError);
	});

	it("allows exactly one concurrent first administrator", async () => {
		const other = database.connect();
		try {
			const results = await Promise.allSettled([
				createFirstUser(db, {
					handle: "alice",
					email: "alice@example.com",
					password: "a-real-password",
					deliveryAvailable: false,
					keyring,
					getVerificationUrl: () => "https://virtool.test/verify-email",
				}),
				createFirstUser(other.db, {
					handle: "bob",
					email: "bob@example.com",
					password: "another-real-password",
					deliveryAvailable: false,
					keyring,
					getVerificationUrl: () => "https://virtool.test/verify-email",
				}),
			]);
			expect(
				results.filter(({ status }) => status === "fulfilled"),
			).toHaveLength(1);
			expect(await db.select().from(users)).toHaveLength(1);
		} finally {
			await other.close();
		}
	});
});

describe("logout", () => {
	it("invalidates setup state and clears the setup cookies", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const setup = await seedSetupSession(db, userId, "account_completion");
		const cookies = fakeCookies(setup.sessionId);

		await logout(db, cookies);

		expect(await db.select().from(setupSessions)).toHaveLength(0);
		expect(cookies.clearSetup).toHaveBeenCalledOnce();
	});
});
