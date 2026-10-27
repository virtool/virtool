import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { verifyPassword } from "@virtool/data/auth/password";
import {
	seedSession,
	seedSetupSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import { createKeyring } from "@virtool/data/crypto/keyring";
import type { Db } from "@virtool/data/db/pg";
import {
	authAccounts,
	authRateLimits,
	authSessions,
	authVerifications,
} from "@virtool/data/db/schema/auth";
import { emailOutbox } from "@virtool/data/db/schema/emailOutbox";
import { settings } from "@virtool/data/db/schema/settings";
import { setupSessions } from "@virtool/data/db/schema/setup";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";
import { verifyBrowserPrincipal } from "./verify";

const cookies = new Map<string, string>();
let clientIp: string | undefined;
const getRequest = vi.fn(
	() =>
		new Request("https://virtool.test", {
			headers: {
				origin: "https://virtool.test",
				cookie: [...cookies]
					.map(([key, value]) => `${key}=${value}`)
					.join("; "),
				...(clientIp && { "x-forwarded-for": clientIp }),
			},
		}),
);
vi.mock("@tanstack/react-start/server", () => ({
	getRequest,
	getCookie: (key: string) => cookies.get(key),
	setCookie: (key: string, value: string) => {
		cookies.set(key, value);
	},
	deleteCookie: (key: string) => {
		cookies.delete(key);
	},
}));
let db: Db;
const keyring = createKeyring(
	Buffer.alloc(32, 1).toString("base64"),
	undefined,
);
let auth: ReturnType<typeof import("./betterAuth").createAuth>;
vi.mock("../composition", () => ({
	get db() {
		return db;
	},
	get keyring() {
		return keyring;
	},
}));
vi.mock("./instance", () => ({
	get auth() {
		return auth;
	},
}));
const { createAuth } = await import("./betterAuth");
const { assertTotpEnrollment, seedTrustDevice, sessionCookie, totp } =
	await import("./test/fixtures");
const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
let database: TestDatabase;
const password = "correct-horse-battery-staple";
// Cost 4 keeps the rate-limit tests, which run bcrypt on every attempt, inside
// the test timeout on a loaded CI runner.
const hash = "$2b$04$XSctD3RKH3FLPXW98QyfVOJLW58yyGlwuiNa.3H9i9Jmht51pqvla";

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: "https://virtool.test",
		webauthnRpId: "virtool.test",
		secret: "test-auth-secret-test-auth-secret",
	});
}, 60_000);
afterAll(async () => {
	await database.drop();
});
beforeEach(async () => {
	cookies.clear();
	clientIp = undefined;
	vi.clearAllMocks();
	await db.delete(authRateLimits);
	await db.delete(emailOutbox);
	await db.delete(settings);
	await db.delete(users);
});

it("signs in with a persistent seven-day rolling session", async () => {
	const userId = await seedUser(db, {
		password: Buffer.from(hash),
		email: "alice@virtool.test",
	});
	await db
		.update(users)
		.set({
			username: "alice",
			displayUsername: "Alice",
			authMigratedAt: new Date(),
		})
		.where(eq(users.id, userId));
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: hash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ reset: false });
	const [session] = await db.select().from(authSessions);
	expect(
		(session?.expiresAt.getTime() ?? 0) - (session?.createdAt.getTime() ?? 0),
	).toBeCloseTo(7 * 24 * 60 * 60_000, -2);
	expect(
		[...cookies.keys()].some((name) => name.endsWith("dont_remember")),
	).toBe(false);
	await db
		.update(authSessions)
		.set({ expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60_000) });
	await callServerFn(handlers, "refreshBrowserSessionFn");
	expect(
		(await db.select().from(authSessions))[0]?.expiresAt.getTime(),
	).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60_000);
});

it("replaces a bcrypt hash with Argon2id after a successful sign-in", async () => {
	const userId = await seedUser(db, {
		password: Buffer.from(hash),
		email: "alice@virtool.test",
	});
	await db
		.update(users)
		.set({
			username: "alice",
			displayUsername: "Alice",
			authMigratedAt: new Date(),
		})
		.where(eq(users.id, userId));
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: hash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await expect(
		callServerFn(handlers, "loginFn", { handle: "alice", password: "wrong" }),
	).rejects.toThrow();
	const [unchanged] = await db.select().from(authAccounts);
	expect(unchanged?.password).toBe(hash);

	await callServerFn(handlers, "loginFn", { handle: "alice", password });
	const [[user], [account]] = await Promise.all([
		db.select().from(users).where(eq(users.id, userId)),
		db.select().from(authAccounts),
	]);
	expect(account?.password?.startsWith("$argon2id$")).toBe(true);
	expect(user?.password?.toString("utf8")).toBe(account?.password);

	cookies.clear();
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ reset: false });
});

it("replaces an unmigrated user's bcrypt hash at the remediation sign-in", async () => {
	const userId = await seedUser(db, { password: Buffer.from(hash) });

	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });

	const [user] = await db.select().from(users).where(eq(users.id, userId));
	expect(user?.password?.toString("utf8").startsWith("$argon2id$")).toBe(true);
	expect(await verifyPassword(password, user?.password as Buffer)).toBe(true);
});

it("rolls an eligible session only through the intentional refresh function", async () => {
	const userId = await seedUser(db);
	const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60_000);
	const session = await seedSession(db, userId, { expiresAt });
	const cookie = sessionCookie(session).replace(
		"better-auth.session_token",
		"__Secure-better-auth.session_token",
	);
	const separator = cookie.indexOf("=");
	cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));

	await auth.api.getSession({
		headers: getRequest().headers,
		query: { disableRefresh: true },
	});
	expect((await db.select().from(authSessions))[0]?.expiresAt).toEqual(
		expiresAt,
	);
	expect(await callServerFn(handlers, "refreshBrowserSessionFn")).toBeNull();
	const [refreshed] = await db.select().from(authSessions);
	expect(refreshed?.expiresAt.getTime()).toBeGreaterThan(
		Date.now() + 6 * 24 * 60 * 60_000,
	);
	expect(refreshed?.token).toBe(session.token);

	await callServerFn(handlers, "refreshBrowserSessionFn");
	expect((await db.select().from(authSessions))[0]?.expiresAt).toEqual(
		refreshed?.expiresAt,
	);
});

it("rejects an expired session without reviving it", async () => {
	const userId = await seedUser(db);
	const session = await seedSession(db, userId, {
		expiresAt: new Date(Date.now() - 60_000),
	});
	const cookie = sessionCookie(session).replace(
		"better-auth.session_token",
		"__Secure-better-auth.session_token",
	);
	const separator = cookie.indexOf("=");
	cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));
	await expect(
		callServerFn(handlers, "refreshBrowserSessionFn"),
	).rejects.toThrow("Unauthorized");
});

it("completes offline remediation with an unverified email and one session", async () => {
	const userId = await seedUser(db, {
		email: "",
		handle: "Alice",
		password: Buffer.from(hash),
	});

	expect(
		await callServerFn(handlers, "loginFn", {
			handle: "alice",
			password,
		}),
	).toEqual({ remediation: true, reset: false });
	expect(await db.select().from(setupSessions)).toHaveLength(1);

	expect(
		await callServerFn(handlers, "submitEmailRemediationFn", {
			email: " Alice@Example.com ",
		}),
	).toEqual({ complete: true });

	const [user] = await db.select().from(users);
	expect(user).toMatchObject({
		id: userId,
		email: "alice@example.com",
		emailVerified: false,
	});
	expect(user?.authMigratedAt).toBeInstanceOf(Date);
	expect(await db.select().from(authAccounts)).toHaveLength(1);
	expect(await db.select().from(authSessions)).toHaveLength(1);
	expect(await db.select().from(setupSessions)).toHaveLength(0);
	expect(
		Number(
			(await auth.api.getSession({ headers: getRequest().headers }))?.user.id,
		),
	).toBe(userId);
});

it("forces a reset on the session that email remediation establishes", async () => {
	const userId = await seedUser(db, {
		email: "",
		forceReset: true,
		handle: "Alice",
		password: Buffer.from(hash),
	});

	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
	expect(
		await callServerFn(handlers, "submitEmailRemediationFn", {
			email: "alice@example.com",
		}),
	).toEqual({ complete: true });

	const [established] = await db.select().from(authSessions);
	if (!established) {
		throw new Error("remediation did not create a session");
	}
	const principal = await verifyBrowserPrincipal(db, getRequest());
	expect(principal).toMatchObject({
		kind: "password_reset",
		userId,
		sessionId: established.id,
	});

	const newPassword = "new-correct-horse-battery-staple";
	expect(
		await callServerFn(
			handlers,
			"resetPasswordFn",
			{ password: newPassword },
			{ principal },
		),
	).toEqual({ login: false, reset: false });

	expect(await verifyBrowserPrincipal(db, getRequest())).toMatchObject({
		kind: "browser",
		userId,
	});
	const [user] = await db.select().from(users);
	const [account] = await db.select().from(authAccounts);
	if (!user?.password || !account?.password) {
		throw new Error("expected both password copies");
	}
	expect(user.forceReset).toBe(false);
	expect(await verifyPassword(newPassword, user.password)).toBe(true);
	expect(
		await verifyPassword(newPassword, Buffer.from(account.password, "utf8")),
	).toBe(true);
});

it("requires the emailed token before marking a remediated email verified", async () => {
	const userId = await seedUser(db, {
		email: "",
		handle: "Alice",
		password: Buffer.from(hash),
	});
	const encrypted = keyring.encrypt("resend_api_key", "re_secret");
	if (!encrypted.ok) {
		throw new Error("expected a ready keyring");
	}
	await seedSettings(db, {
		emailApiKey: encrypted.value,
		emailEnabled: true,
		emailSenderAddress: "noreply@virtool.test",
	});
	const setup = await seedSetupSession(db, userId, "email_remediation");
	cookies.set("setup_session_id", setup.sessionId);
	cookies.set("setup_session_token", setup.token);

	expect(
		await callServerFn(handlers, "submitEmailRemediationFn", {
			email: "alice@example.com",
			redirect: "/samples",
		}),
	).toMatchObject({
		complete: false,
		state: {
			status: "pending",
			maskedEmail: "a***e@example.com",
		},
	});

	const [queued] = await db.select().from(emailOutbox);
	if (queued?.template.type !== "email_verification") {
		throw new Error("expected an email verification message");
	}
	const fragment = new URLSearchParams(
		new URL(queued.template.verifyUrl).hash.slice(1),
	);
	const token = fragment.get("token");
	expect(fragment.get("redirect")).toBe("/samples");
	if (!token) {
		throw new Error("expected a verification token");
	}
	expect((await db.select().from(users))[0]).toMatchObject({
		email: "",
		emailVerified: false,
	});
	expect(await db.select().from(authAccounts)).toHaveLength(0);

	expect(
		await callServerFn(handlers, "completeEmailRemediationFn", { token }),
	).toEqual({
		status: "verified",
		authenticated: true,
		canRetry: true,
	});

	const [user] = await db.select().from(users);
	expect(user?.emailVerified).toBe(true);
	expect(user?.authMigratedAt).toBeInstanceOf(Date);
	expect(await db.select().from(authSessions)).toHaveLength(1);
});

it("verifies cross-browser without authentication and lets the original browser continue", async () => {
	const userId = await seedUser(db, {
		email: "",
		handle: "Alice",
		password: Buffer.from(hash),
	});
	const encrypted = keyring.encrypt("resend_api_key", "re_secret");
	if (!encrypted.ok) {
		throw new Error("expected a ready keyring");
	}
	await seedSettings(db, {
		emailApiKey: encrypted.value,
		emailEnabled: true,
		emailSenderAddress: "noreply@virtool.test",
	});
	const setup = await seedSetupSession(db, userId, "email_remediation");
	cookies.set("setup_session_id", setup.sessionId);
	cookies.set("setup_session_token", setup.token);
	await callServerFn(handlers, "submitEmailRemediationFn", {
		email: "alice@example.com",
	});
	const [queued] = await db.select().from(emailOutbox);
	if (queued?.template.type !== "email_verification") {
		throw new Error("expected an email verification message");
	}
	const token = new URLSearchParams(
		new URL(queued.template.verifyUrl).hash.slice(1),
	).get("token");
	if (!token) {
		throw new Error("expected verification token");
	}

	cookies.clear();
	expect(
		await callServerFn(handlers, "completeEmailRemediationFn", { token }),
	).toEqual({
		status: "verified",
		authenticated: false,
		canRetry: false,
	});
	expect(await db.select().from(authSessions)).toHaveLength(0);
	expect(await db.select().from(setupSessions)).toHaveLength(1);
	expect(
		await callServerFn(handlers, "completeEmailRemediationFn", { token }),
	).toEqual({
		status: "already_verified",
		authenticated: false,
		canRetry: false,
	});

	cookies.set("setup_session_id", setup.sessionId);
	cookies.set("setup_session_token", setup.token);
	expect(await callServerFn(handlers, "getEmailRemediationFn")).toEqual({
		status: "verified",
	});
	expect(await callServerFn(handlers, "promoteEmailRemediationFn")).toEqual({
		complete: true,
	});
	expect(await db.select().from(authSessions)).toHaveLength(1);
	expect(await db.select().from(setupSessions)).toHaveLength(0);
});

it("does not report an anonymous unknown token as authenticated", async () => {
	expect(
		await callServerFn(handlers, "completeEmailRemediationFn", {
			token: "a".repeat(64),
		}),
	).toEqual({
		status: "unusable",
		authenticated: false,
		canRetry: false,
	});
});

async function enroll(forceReset: boolean) {
	const [user] = await db
		.insert(users)
		.values({
			handle: "Alice",
			username: "alice",
			displayUsername: "Alice",
			name: "Alice",
			email: "alice@virtool.test",
			password: Buffer.from(hash),
			lastPasswordChange: new Date(),
			settings: {},
			active: true,
			lifecycleState: "normal",
			authMigratedAt: new Date(),
			forceReset,
		})
		.returning({ id: users.id });
	if (!user) {
		throw new Error("Missing seeded user");
	}
	await db.insert(authAccounts).values({
		accountId: String(user.id),
		providerId: "credential",
		userId: user.id,
		password: hash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await auth.api.signInUsername({ body: { username: "alice", password } });
	const enrollment = assertTotpEnrollment(
		await auth.api.enableTwoFactor({
			headers: getRequest().headers,
			body: { password },
		}),
	);
	await auth.api.verifyTOTP({
		headers: getRequest().headers,
		body: { code: totp(enrollment.totpURI) },
	});
	await db.delete(authSessions);
	cookies.clear();
	return { ...enrollment, userId: user.id };
}

it.each([false, true])(
	"completes the pending TOTP challenge with forceReset=%s",
	async (forceReset) => {
		const { totpURI, userId } = await enroll(forceReset);
		expect(
			await callServerFn(handlers, "loginFn", { handle: "alice", password }),
		).toEqual({ twoFactorRedirect: true });
		expect(await db.select().from(authSessions)).toEqual([]);
		expect(
			await auth.api.getSession({ headers: getRequest().headers }),
		).toBeNull();
		expect(
			await callServerFn(handlers, "verifyTwoFactorFn", {
				code: totp(totpURI),
				recovery: false,
			}),
		).toEqual({ reset: forceReset });
		const session = await auth.api.getSession({
			headers: getRequest().headers,
		});
		expect(Number(session?.user.id)).toBe(userId);
	},
);

it("keeps a TOTP user signed in after a forced reset", async () => {
	const { totpURI, userId } = await enroll(true);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });
	await callServerFn(handlers, "verifyTwoFactorFn", {
		code: totp(totpURI),
		recovery: false,
	});
	const [reset] = await db.select().from(authSessions);
	if (!reset) {
		throw new Error("second factor did not create a session");
	}

	expect(
		await callServerFn(
			handlers,
			"resetPasswordFn",
			{ password: "new-correct-horse-battery-staple" },
			{
				principal: {
					kind: "password_reset",
					userId,
					sessionId: reset.id,
					createdAt: reset.createdAt,
				},
			},
		),
	).toEqual({ login: false, reset: false });

	const sessions = await db.select().from(authSessions);
	expect(sessions).toHaveLength(1);
	const session = await auth.api.getSession({
		headers: getRequest().headers,
	});
	expect(Number(session?.session.id)).toBe(sessions[0]?.id);
	expect(Number(session?.user.id)).toBe(userId);
});

it("asks for TOTP at sign-in from a browser that holds a trust cookie", async () => {
	const { userId } = await enroll(false);
	const trust = await seedTrustDevice(db, userId);
	cookies.set(trust.name, trust.value);

	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ twoFactorRedirect: true });
	expect(await db.select().from(authSessions)).toEqual([]);
	expect(
		await db
			.select({ id: authVerifications.id })
			.from(authVerifications)
			.where(eq(authVerifications.identifier, trust.identifier)),
	).toHaveLength(1);
});

it("refuses to trust the device when the second factor is verified", async () => {
	const { totpURI } = await enroll(false);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });

	await expect(
		auth.api.verifyTOTP({
			headers: getRequest().headers,
			body: { code: totp(totpURI), trustDevice: true },
		}),
	).rejects.toMatchObject({ body: { code: "TRUST_DEVICE_UNSUPPORTED" } });
	expect(await db.select().from(authSessions)).toEqual([]);
	expect(
		[...cookies.keys()].filter((name) => name.endsWith("trust_device")),
	).toEqual([]);
});

it("keeps invalid codes unauthenticated and permits recovery-code continuation", async () => {
	const { backupCodes, userId } = await enroll(false);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });
	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: "invalid",
			recovery: false,
		}),
	).rejects.toMatchObject({
		name: CLIENT_ERROR_NAME,
		message: "The code is not correct. Enter the code your app shows now.",
		status: 400,
	});
	expect(await db.select().from(authSessions)).toEqual([]);
	expect(
		await callServerFn(handlers, "verifyTwoFactorFn", {
			code: backupCodes[0],
			recovery: true,
		}),
	).toEqual({ reset: false });
	expect(
		Number(
			(await auth.api.getSession({ headers: getRequest().headers }))?.user.id,
		),
	).toBe(userId);
});

it("rejects verification without a pending challenge", async () => {
	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: "123456",
			recovery: false,
		}),
	).rejects.toMatchObject({
		name: CLIENT_ERROR_NAME,
		message: "Your sign-in expired. Sign in again.",
		status: 410,
	});
	expect(await db.select().from(authSessions)).toEqual([]);
});

it("refuses an incorrect recovery code with its own message", async () => {
	await enroll(false);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });

	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: "not-a-code",
			recovery: true,
		}),
	).rejects.toMatchObject({
		name: CLIENT_ERROR_NAME,
		message: "The recovery code is not correct.",
		status: 400,
	});
});

it("expires the challenge after five incorrect codes", async () => {
	const { totpURI } = await enroll(false);
	await callServerFn(handlers, "loginFn", { handle: "alice", password });
	for (let attempt = 0; attempt < 5; attempt++) {
		await expect(
			callServerFn(handlers, "verifyTwoFactorFn", {
				code: "000000",
				recovery: false,
			}),
		).rejects.toMatchObject({ status: 400 });
	}

	await expect(
		callServerFn(handlers, "verifyTwoFactorFn", {
			code: totp(totpURI),
			recovery: false,
		}),
	).rejects.toMatchObject({
		name: CLIENT_ERROR_NAME,
		message: "Your sign-in expired. Sign in again.",
		status: 410,
	});
	expect(await db.select().from(authSessions)).toEqual([]);
});

async function expectRateLimited(handle: string, attempt: string) {
	await expect(
		callServerFn(handlers, "loginFn", { handle, password: attempt }),
	).rejects.toMatchObject({
		name: CLIENT_ERROR_NAME,
		message: expect.stringContaining("Too many sign-in attempts"),
		status: 429,
	});
}

async function failLogin(handle: string) {
	await expect(
		callServerFn(handlers, "loginFn", { handle, password: "wrong-password" }),
	).rejects.toThrow("Invalid handle or password.");
}

it("limits password sign-in attempts from one address", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });

	clientIp = "198.51.100.1";
	for (let attempt = 0; attempt < 3; attempt++) {
		await failLogin(`nobody-${attempt}`);
	}

	await expectRateLimited("alice", password);
	expect(await db.select().from(setupSessions)).toEqual([]);

	clientIp = "198.51.100.2";
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
});

it("doesn't spend an account's budget on a blocked address", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });

	clientIp = "198.51.100.1";
	for (let attempt = 0; attempt < 3; attempt++) {
		await failLogin(`nobody-${attempt}`);
	}
	for (let attempt = 0; attempt < 10; attempt++) {
		await expectRateLimited("alice", "wrong-password");
	}

	clientIp = "198.51.100.2";
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
});

it("limits failed attempts for one account across addresses", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });

	for (let attempt = 0; attempt < 10; attempt++) {
		clientIp = `198.51.100.${attempt}`;
		await failLogin(attempt % 2 === 0 ? "alice" : " ALICE ");
	}

	clientIp = "203.0.113.1";
	await expectRateLimited("alice", password);
	expect(await db.select().from(setupSessions)).toEqual([]);
});

it("limits a handle with no account like an existing one", async () => {
	for (let attempt = 0; attempt < 10; attempt++) {
		clientIp = `198.51.100.${attempt}`;
		await failLogin("nobody");
	}

	clientIp = "203.0.113.1";
	await expectRateLimited("nobody", password);
});

it("clears an account's failures after a correct password", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });

	for (let round = 0; round < 2; round++) {
		for (let attempt = 0; attempt < 9; attempt++) {
			clientIp = `198.51.${round}.${attempt}`;
			await failLogin("alice");
		}
		clientIp = `203.0.113.${round}`;
		expect(
			await callServerFn(handlers, "loginFn", { handle: "alice", password }),
		).toEqual({ remediation: true, reset: false });
		cookies.clear();
	}
});

async function signInFromDevice(): Promise<string> {
	clientIp = "192.0.2.1";
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
	const device = cookies.get("login_device");
	expect(device).toMatch(/^\d+\.\d+\.[\w-]+$/);
	cookies.clear();
	return device as string;
}

async function lockOutAlice() {
	for (let attempt = 0; attempt < 10; attempt++) {
		clientIp = `198.51.100.${attempt}`;
		await failLogin("alice");
	}
	clientIp = "203.0.113.1";
	await expectRateLimited("alice", password);
}

it("lets a known browser sign in while the account is locked", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });
	const device = await signInFromDevice();
	await lockOutAlice();

	cookies.set("login_device", device);
	clientIp = "192.0.2.2";
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
});

it("limits failed attempts from a known browser on its own budget", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });
	const device = await signInFromDevice();

	for (let attempt = 0; attempt < 5; attempt++) {
		cookies.set("login_device", device);
		clientIp = `198.51.100.${attempt}`;
		await failLogin("alice");
	}

	clientIp = "203.0.113.1";
	await expectRateLimited("alice", password);

	cookies.clear();
	clientIp = "203.0.113.2";
	expect(
		await callServerFn(handlers, "loginFn", { handle: "alice", password }),
	).toEqual({ remediation: true, reset: false });
});

it("ignores a known browser after a password change", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });
	const device = await signInFromDevice();
	await db
		.update(users)
		.set({ lastPasswordChange: new Date(Date.now() + 1000) })
		.where(eq(users.handle, "alice"));
	await lockOutAlice();

	cookies.set("login_device", device);
	clientIp = "192.0.2.2";
	await expectRateLimited("alice", password);
});

it("ignores a tampered device", async () => {
	await seedUser(db, { handle: "alice", password: Buffer.from(hash) });
	const device = await signInFromDevice();
	await lockOutAlice();

	const [userId, expiresAt, mac] = device.split(".");
	cookies.set("login_device", `${userId}.${Number(expiresAt) + 1000}.${mac}`);
	clientIp = "192.0.2.2";
	await expectRateLimited("alice", password);
});
