import { emptyPermissions } from "@virtool/contracts";
import { hashPassword } from "@virtool/data/auth/password";
import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import {
	authAccounts,
	authPasskeys,
	authRateLimits,
	authSessions,
	authTwoFactors,
} from "@virtool/data/db/schema/auth";
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
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const ORIGIN = "http://localhost";
const CLIENT_IP = "203.0.113.7";

const cookies = new Map<string, string>();
const getRequest = vi.fn(
	() =>
		new Request(`${ORIGIN}/_serverFn/test`, {
			headers: {
				origin: ORIGIN,
				"x-forwarded-for": CLIENT_IP,
				cookie: [...cookies]
					.map(([key, value]) => `${key}=${value}`)
					.join("; "),
			},
		}),
);

vi.mock("@tanstack/react-start/server", () => ({
	getRequest,
	setResponseStatus: vi.fn(),
	getCookie: (key: string) => cookies.get(key),
	setCookie: (key: string, value: string, options?: { maxAge?: number }) => {
		if (options?.maxAge === 0) {
			cookies.delete(key);
		} else {
			cookies.set(key, value);
		}
	},
	deleteCookie: (key: string) => {
		cookies.delete(key);
	},
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
	setContext: vi.fn(),
}));

let db: Db;
let auth: ReturnType<typeof import("../auth/betterAuth").createAuth>;

vi.mock("../composition", () => ({
	get db() {
		return db;
	},
}));

vi.mock("../auth/instance", () => ({
	get auth() {
		return auth;
	},
}));

const { createAuth } = await import("../auth/betterAuth");
const { SESSION_FRESH_AGE_SECONDS } = await import("../auth/freshness");
const { SessionNotFreshError } = await import("../auth/policy");
const { interceptPasskeyInsert, sessionCookie } = await import(
	"../auth/test/fixtures"
);
const { createSoftwareAuthenticator } = await import("../auth/test/webauthn");
const { ClientError } = await import("../errors");
const { BrowserSessionEndedError, removeAccountPasskey } = await import(
	"./service"
);
const accountHandlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const authHandlers = (await import(
	"../auth/functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;

let database: TestDatabase;
let passwordHash: string;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: ORIGIN,
		webauthnRpId: "localhost",
		secret: "test-auth-secret-test-auth-secret",
	});
	passwordHash = (await hashPassword("password")).toString("utf8");
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	cookies.clear();
	vi.clearAllMocks();
	await Promise.all([db.delete(users), db.delete(authRateLimits)]);
});

function account(name: string, data?: unknown) {
	return callServerFn(accountHandlers, name, data);
}

async function seedAccount(handle = "Alice") {
	const userId = await seedUser(db, { handle });
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: passwordHash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return userId;
}

async function signInAs(userId: number, createdAt = new Date()) {
	cookies.clear();
	const session = await seedSession(db, userId, {
		createdAt,
		expiresAt: new Date(Date.now() + 60 * 60_000),
	});
	const [name, value] = sessionCookie(session).split("=");
	cookies.set(name ?? "", value ?? "");
}

function authenticator() {
	return createSoftwareAuthenticator({ origin: ORIGIN, rpId: "localhost" });
}

async function registerPasskey(key = authenticator()) {
	const options = (await account("getPasskeyRegistrationOptionsFn")) as {
		challenge: string;
	};
	return account("registerPasskeyFn", { response: key.register(options) });
}

async function seedPasskey(
	userId: number,
	credentialID: string,
	createdAt: Date | null = new Date(),
) {
	const [row] = await db
		.insert(authPasskeys)
		.values({
			userId,
			credentialID,
			publicKey: "public-key",
			counter: 3,
			deviceType: "singleDevice",
			backedUp: false,
			aaguid: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
			createdAt,
		})
		.returning({ id: authPasskeys.id });
	return row?.id ?? 0;
}

describe("registration", () => {
	it("names the credential after the handle, not the email", async () => {
		const userId = await seedAccount("Alice");
		await db
			.update(users)
			.set({ email: "alice@example.com" })
			.where(eq(users.id, userId));
		await signInAs(userId);

		const options = (await account("getPasskeyRegistrationOptionsFn")) as {
			user: { name: string; displayName: string };
		};

		expect(options.user).toMatchObject({
			name: "Alice",
			displayName: "Alice",
		});
	});

	it("returns a redacted summary of the new passkey", async () => {
		const userId = await seedAccount();
		await signInAs(userId);

		const summary = await registerPasskey();

		expect(summary).toEqual({
			managementId: expect.any(Number),
			name: "Passkey",
			createdAt: expect.any(Date),
			multiDevice: true,
			backedUp: true,
		});
	});

	it("asks for a recent authentication before generating options", async () => {
		const userId = await seedAccount();
		await signInAs(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(
			account("getPasskeyRegistrationOptionsFn"),
		).rejects.toBeInstanceOf(SessionNotFreshError);
	});

	it("asks for a recent authentication if the session goes stale mid-ceremony", async () => {
		const userId = await seedAccount();
		await signInAs(userId);
		const options = (await account("getPasskeyRegistrationOptionsFn")) as {
			challenge: string;
		};
		await db.update(authSessions).set({
			createdAt: new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		});

		await expect(
			account("registerPasskeyFn", {
				response: authenticator().register(options),
			}),
		).rejects.toBeInstanceOf(SessionNotFreshError);
		expect(await db.select().from(authPasskeys)).toEqual([]);
	});

	it("reports a passkey registered twice as a conflict", async () => {
		const userId = await seedAccount();
		await signInAs(userId);
		const key = authenticator();
		await registerPasskey(key);

		await expect(registerPasskey(key)).rejects.toMatchObject({
			status: 409,
		});
	});

	it("surfaces a failure to store a verified passkey as a server error", async () => {
		const userId = await seedAccount();
		await signInAs(userId);
		const spy = interceptPasskeyInsert(db, () =>
			Promise.reject(new Error("connection lost")),
		);

		try {
			const error = await registerPasskey().catch((err: unknown) => err);

			expect(error).toBeInstanceOf(Error);
			expect(error).not.toBeInstanceOf(ClientError);
		} finally {
			spy.mockRestore();
		}
		expect(await db.select().from(authPasskeys)).toEqual([]);
	});

	it("reports a response that fails verification as a client error", async () => {
		const userId = await seedAccount();
		await signInAs(userId);
		const options = (await account("getPasskeyRegistrationOptionsFn")) as {
			challenge: string;
		};
		const key = createSoftwareAuthenticator({
			origin: "https://evil.test",
			rpId: "localhost",
		});

		const error = await account("registerPasskeyFn", {
			response: key.register(options),
		}).catch((err: unknown) => err);

		expect(error).toBeInstanceOf(ClientError);
		expect(error).toMatchObject({ status: 400 });
	});
});

describe("listing", () => {
	it("returns only the user's passkeys, oldest first, without credential material", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const newer = await seedPasskey(userId, "newer", new Date(2026, 1, 2));
		const older = await seedPasskey(userId, "older", new Date(2026, 1, 1));
		await seedPasskey(bobId, "bob");
		await signInAs(userId);

		const passkeys = (await account("findPasskeysFn")) as object[];

		expect(passkeys).toEqual([
			{
				managementId: older,
				name: "Passkey",
				createdAt: new Date(2026, 1, 1),
				multiDevice: false,
				backedUp: false,
			},
			expect.objectContaining({ managementId: newer }),
		]);
		const serialized = JSON.stringify(passkeys);
		for (const secret of ["public-key", "older", "fbfc3007", "counter"]) {
			expect(serialized).not.toContain(secret);
		}
	});
});

describe("renaming", () => {
	it("normalizes whitespace in the new name", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		const result = await account("renamePasskeyFn", {
			managementId,
			name: "  Work   laptop ",
		});

		expect(result).toMatchObject({ managementId, name: "Work laptop" });
	});

	it.each([
		["an empty name", "   "],
		["a name that is too long", "x".repeat(65)],
		["a control character", "Work\u0007"],
	])("refuses %s", async (_, name) => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await expect(
			account("renamePasskeyFn", { managementId, name }),
		).rejects.toThrow();
	});

	it("answers another user's passkey as not found and leaves it unchanged", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const managementId = await seedPasskey(bobId, "bob");
		await signInAs(userId);

		await expect(
			account("renamePasskeyFn", { managementId, name: "Mine" }),
		).rejects.toMatchObject({ status: 404 });
		expect((await db.select().from(authPasskeys))[0]?.name).toBeNull();
	});

	it("asks for a recent authentication", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(
			account("renamePasskeyFn", { managementId, name: "Work" }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
	});
});

describe("removal", () => {
	it("removes the final passkey while the password remains", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		expect(await db.select().from(authPasskeys)).toEqual([]);
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("leaves every other credential and the current session in place", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		const kept = await seedPasskey(userId, "kept");
		await db.insert(authTwoFactors).values({
			userId,
			secret: "secret",
			backupCodes: "codes",
		});
		await db.insert(apiKeys).values({
			hashed: "hash",
			name: "Robot",
			userId,
			permissions: emptyPermissions(),
			createdAt: new Date(),
		});
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		expect((await db.select().from(authPasskeys)).map(({ id }) => id)).toEqual([
			kept,
		]);
		expect(await db.select().from(authTwoFactors)).toHaveLength(1);
		expect(await db.select().from(apiKeys)).toHaveLength(1);
		expect(await db.select().from(authSessions)).toHaveLength(1);
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("refuses when the user has no password to fall back on", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await db.delete(authAccounts);
		await signInAs(userId);

		await expect(
			account("removePasskeyFn", { managementId }),
		).rejects.toMatchObject({ status: 409 });
		expect(await db.select().from(authPasskeys)).toHaveLength(1);
	});

	it("never removes another user's passkey", async () => {
		const userId = await seedAccount();
		const bobId = await seedAccount("Bob");
		const managementId = await seedPasskey(bobId, "bob");
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		expect(await db.select().from(authPasskeys)).toHaveLength(1);
	});

	it("succeeds when repeated", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(userId);

		await account("removePasskeyFn", { managementId });

		await expect(
			account("removePasskeyFn", { managementId }),
		).resolves.toBeNull();
	});

	it("asks for a recent authentication", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		await signInAs(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(
			account("removePasskeyFn", { managementId }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
		expect(await db.select().from(authPasskeys)).toHaveLength(1);
	});

	it("locks the user before the session, as a credential reset does", async () => {
		const userId = await seedAccount();
		const managementId = await seedPasskey(userId, "credential");
		const session = await seedSession(db, userId, {
			expiresAt: new Date(Date.now() + 60 * 60_000),
		});
		const holder = database.connect();
		const observer = database.connect();
		const release = Promise.withResolvers<void>();
		const locked = Promise.withResolvers<void>();

		try {
			const reset = holder.client.begin(async (tx) => {
				await tx`select id from users where id = ${userId} for update`;
				locked.resolve();
				await release.promise;
				await tx`delete from auth_sessions where user_id = ${userId}`;
			});
			await locked.promise;

			const removal = removeAccountPasskey(
				db,
				userId,
				session.sessionId,
				managementId,
			);
			let isWaiting = false;
			for (let attempt = 0; attempt < 100; attempt += 1) {
				const rows = await observer.client<{ pid: number }[]>`
					select pid
					from pg_stat_activity
					where datname = current_database()
						and wait_event_type = 'Lock'
				`;
				if (rows.length > 0) {
					isWaiting = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			expect(isWaiting).toBe(true);

			release.resolve();
			await reset;
			await expect(removal).rejects.toBeInstanceOf(BrowserSessionEndedError);
			expect(await db.select().from(authPasskeys)).toHaveLength(1);
		} finally {
			release.resolve();
			await Promise.all([holder.close(), observer.close()]);
		}
	});
});

describe("sign-in", () => {
	async function enroll() {
		const userId = await seedAccount();
		await signInAs(userId);
		const key = authenticator();
		await registerPasskey(key);
		cookies.clear();
		await db.delete(authSessions);
		return { key, userId };
	}

	async function signIn(
		key: ReturnType<typeof authenticator>,
		ceremony?: Parameters<typeof key.authenticate>[1],
	) {
		const options = (await callServerFn(
			authHandlers,
			"getPasskeySignInOptionsFn",
		)) as { challenge: string; userVerification: string };
		expect(options.userVerification).toBe("required");
		return callServerFn(authHandlers, "signInWithPasskeyFn", {
			response: key.authenticate(options, ceremony),
		});
	}

	it("signs in with the passkey", async () => {
		const { key, userId } = await enroll();

		await expect(signIn(key)).resolves.toEqual({ reset: false });
		expect(await db.select().from(authSessions)).toMatchObject([{ userId }]);
	});

	it("reports a forced reset as a password sign-in would", async () => {
		const { key, userId } = await enroll();
		await db
			.update(users)
			.set({ forceReset: true })
			.where(eq(users.id, userId));

		await expect(signIn(key)).resolves.toEqual({ reset: true });
	});

	it("sends a TOTP-enrolled user to the second factor", async () => {
		const { key, userId } = await enroll();
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await db
			.insert(authTwoFactors)
			.values({ userId, secret: "secret", backupCodes: "codes" });

		await expect(signIn(key)).resolves.toEqual({ twoFactorRedirect: true });
		expect(await db.select().from(authSessions)).toEqual([]);
	});

	it.each([
		["an unverified user", { userVerified: false }],
		["another origin", { origin: "https://evil.test" }],
	])("gives %s the generic failure", async (_, ceremony) => {
		const { key } = await enroll();

		const error = await signIn(key, ceremony).catch((err: Error) => err);

		expect(error).toBeInstanceOf(ClientError);
		expect((error as Error).message).toBe(
			"Passkey sign-in failed. Try again or sign in with your password.",
		);
	});

	it("gives a deactivated user the generic failure", async () => {
		const { key, userId } = await enroll();
		await db.update(users).set({ active: false }).where(eq(users.id, userId));

		await expect(signIn(key)).rejects.toBeInstanceOf(ClientError);
		expect(await db.select().from(authSessions)).toEqual([]);
	});

	it("gives an unknown passkey the generic failure", async () => {
		await expect(signIn(authenticator())).rejects.toBeInstanceOf(ClientError);
	});

	it("gives a removed passkey the generic failure", async () => {
		const { key } = await enroll();
		await db.delete(authPasskeys);

		await expect(signIn(key)).rejects.toBeInstanceOf(ClientError);
	});

	it("sets the challenge cookie and then the session cookie", async () => {
		const { key } = await enroll();

		const options = (await callServerFn(
			authHandlers,
			"getPasskeySignInOptionsFn",
		)) as { challenge: string };

		expect(cookies.get("better-auth.better-auth-passkey")).toEqual(
			expect.any(String),
		);
		expect(cookies.has("better-auth.session_token")).toBe(false);

		await callServerFn(authHandlers, "signInWithPasskeyFn", {
			response: key.authenticate(options),
		});

		const [session] = await db.select().from(authSessions);
		expect(cookies.get("better-auth.session_token")).toMatch(
			new RegExp(`^${session?.token}\\.`),
		);
	});

	it("sets the two-factor cookie for a TOTP-enrolled user", async () => {
		const { key, userId } = await enroll();
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await db
			.insert(authTwoFactors)
			.values({ userId, secret: "secret", backupCodes: "codes" });

		await signIn(key);

		expect(cookies.get("better-auth.two_factor")).toEqual(expect.any(String));
		expect(cookies.has("better-auth.session_token")).toBe(false);
	});

	it("refuses a fourth request for options from one address within the window", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await callServerFn(authHandlers, "getPasskeySignInOptionsFn");
		}
		const error = await callServerFn(
			authHandlers,
			"getPasskeySignInOptionsFn",
		).catch((err: Error) => err);

		expect(error).toBeInstanceOf(ClientError);
		expect(error).toMatchObject({
			status: 429,
			message: "Too many sign-in attempts. Wait and try again.",
		});
		expect(await db.select().from(authRateLimits)).toEqual([
			expect.objectContaining({
				key: `${CLIENT_IP}|/passkey/generate-authenticate-options`,
				count: 3,
			}),
		]);
	});
});
