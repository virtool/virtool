import {
	AUTH_BASE_PATH,
	RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH,
} from "@virtool/contracts";
import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import {
	authPasskeys,
	authRateLimits,
	authSessions,
	authTwoFactors,
	authVerifications,
} from "@virtool/data/db/schema/auth";
import { settings } from "@virtool/data/db/schema/settings";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth, createAuthRequestHandler } from "./betterAuth";
import { SESSION_FRESH_AGE_SECONDS } from "./freshness";
import { sessionCookie } from "./test/fixtures";
import { createSoftwareAuthenticator } from "./test/webauthn";

const ORIGIN = "https://virtool.test";
const RP_ID = "virtool.test";
const CLIENT_IP = "203.0.113.7";

let database: TestDatabase;
let db: Db;
let handleAuthRequest: (request: Request) => Promise<Response>;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	handleAuthRequest = createAuthRequestHandler(
		db,
		createAuth({
			db,
			publicOrigin: ORIGIN,
			webauthnRpId: RP_ID,
			secret: "test-auth-secret-test-auth-secret",
		}),
	);
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await Promise.all([
		db.delete(users),
		db.delete(authVerifications),
		db.delete(authRateLimits),
		db.delete(settings),
	]);
});

/** A minimal browser that keeps the latest value of each cookie. */
function createBrowser(initialCookie?: string) {
	const cookies = new Map<string, string>();

	function add(pair: string) {
		const [name, ...rest] = pair.split("=");
		if (name) {
			cookies.set(name.trim(), rest.join("="));
		}
	}

	if (initialCookie) {
		add(initialCookie);
	}

	return {
		get(name: string) {
			return cookies.get(name) ?? "";
		},
		has(name: string) {
			return (cookies.get(name) ?? "") !== "";
		},
		set(name: string, value: string) {
			cookies.set(name, value);
		},
		async send(method: "GET" | "POST", path: string, body?: unknown) {
			const response = await handleAuthRequest(
				new Request(`${ORIGIN}${AUTH_BASE_PATH}${path}`, {
					method,
					headers: {
						"content-type": "application/json",
						origin: ORIGIN,
						"x-forwarded-for": CLIENT_IP,
						cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
					},
					body: body === undefined ? undefined : JSON.stringify(body),
				}),
			);
			for (const cookie of response.headers.getSetCookie()) {
				const [pair] = cookie.split(";", 1);
				if (pair) {
					add(pair);
				}
			}
			return response;
		},
	};
}

type Browser = ReturnType<typeof createBrowser>;

async function signedInBrowser(userId: number, createdAt = new Date()) {
	const session = await seedSession(db, userId, {
		createdAt,
		expiresAt: new Date(Date.now() + 60 * 60_000),
	});
	// An https base URL gives every Better Auth cookie the `__Secure-` prefix.
	return createBrowser(`__Secure-${sessionCookie(session)}`);
}

function authenticator(credentialId?: Uint8Array) {
	return createSoftwareAuthenticator({
		origin: ORIGIN,
		rpId: RP_ID,
		credentialId,
	});
}

async function registrationOptions(browser: Browser, name = "Alice") {
	const response = await browser.send(
		"GET",
		`/passkey/generate-register-options?name=${name}`,
	);
	expect(response.status).toBe(200);
	return response.json();
}

async function register(
	userId: number,
	key = authenticator(),
	ceremony?: Parameters<typeof key.register>[1],
) {
	const browser = await signedInBrowser(userId);
	const options = await registrationOptions(browser);
	return browser.send("POST", "/passkey/verify-registration", {
		response: key.register(options, ceremony),
		name: "Alice",
	});
}

async function signIn(
	key: ReturnType<typeof authenticator>,
	ceremony?: Parameters<typeof key.authenticate>[1],
) {
	const browser = createBrowser();
	const options = await browser.send(
		"GET",
		"/passkey/generate-authenticate-options",
	);
	expect(options.status).toBe(200);
	const response = await browser.send(
		"POST",
		"/passkey/verify-authentication",
		{ response: key.authenticate(await options.json(), ceremony) },
	);
	return { browser, response };
}

/** Register a passkey for a new user, then end the registering session. */
async function enroll(state: Parameters<typeof seedUser>[1] = {}) {
	const userId = await seedUser(db, state);
	const key = authenticator();
	expect((await register(userId, key)).status).toBe(200);
	await db.delete(authSessions);
	return { key, userId };
}

async function passkeyRows() {
	return db.select().from(authPasskeys);
}

describe("registration", () => {
	it("asks for a verified, discoverable credential labelled with the given name", async () => {
		const userId = await seedUser(db, { email: "alice@example.com" });
		const options = await registrationOptions(await signedInBrowser(userId));

		expect(options.rp).toEqual({ id: RP_ID, name: "Virtool" });
		expect(options.user.name).toBe("Alice");
		expect(options.authenticatorSelection).toMatchObject({
			residentKey: "required",
			userVerification: "required",
		});
	});

	it("stores the public credential against the integer user with the given name", async () => {
		const userId = await seedUser(db);
		const key = authenticator();

		const response = await register(userId, key);

		expect(response.status).toBe(200);
		expect(await passkeyRows()).toMatchObject([
			{
				userId,
				credentialID: key.credentialId,
				name: "Alice",
				deviceType: "multiDevice",
				backedUp: true,
			},
		]);
	});

	it("refuses a credential the authenticator did not verify the user for", async () => {
		const userId = await seedUser(db);

		const response = await register(userId, authenticator(), {
			userVerified: false,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: "USER_VERIFICATION_REQUIRED",
		});
		expect(await passkeyRows()).toEqual([]);
	});

	it.each([
		["another origin", { origin: "https://evil.test" }],
		["another RP ID", { rpId: "evil.test" }],
	])("refuses a response bound to %s", async (_, ceremony) => {
		const userId = await seedUser(db);

		const response = await register(userId, authenticator(), ceremony);

		expect(await response.json()).toMatchObject({
			code: "FAILED_TO_VERIFY_REGISTRATION",
		});
		expect(await passkeyRows()).toEqual([]);
	});

	it("consumes the challenge, so a replayed response is refused", async () => {
		const userId = await seedUser(db);
		const browser = await signedInBrowser(userId);
		const options = await registrationOptions(browser);
		const body = { response: authenticator().register(options) };

		expect(
			(await browser.send("POST", "/passkey/verify-registration", body)).status,
		).toBe(200);

		const replay = await browser.send(
			"POST",
			"/passkey/verify-registration",
			body,
		);
		expect(replay.status).toBe(400);
		expect(await replay.json()).toMatchObject({ code: "CHALLENGE_NOT_FOUND" });
		expect(await passkeyRows()).toHaveLength(1);
	});

	it("lets one of two concurrent completions win", async () => {
		const userId = await seedUser(db);
		const browser = await signedInBrowser(userId);
		const options = await registrationOptions(browser);
		const body = { response: authenticator().register(options) };

		const responses = await Promise.all(
			[0, 1].map(() =>
				browser.send("POST", "/passkey/verify-registration", body),
			),
		);

		expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
		expect(await passkeyRows()).toHaveLength(1);
	});

	it("refuses a credential id another user already holds", async () => {
		const alice = await seedUser(db, { handle: "alice" });
		const bob = await seedUser(db, { handle: "bob" });
		const credentialId = new Uint8Array(32).fill(7);

		await register(alice, authenticator(credentialId));
		const response = await register(bob, authenticator(credentialId));

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: "PASSKEY_ALREADY_REGISTERED",
		});
		expect(await passkeyRows()).toMatchObject([{ userId: alice }]);
	});

	it("refuses to start from a session older than the freshness window", async () => {
		const userId = await seedUser(db);
		const browser = await signedInBrowser(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		const response = await browser.send(
			"GET",
			"/passkey/generate-register-options",
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: "SESSION_NOT_FRESH" });
	});

	it("refuses a session that must reset its password", async () => {
		const userId = await seedUser(db, { forceReset: true });
		const browser = await signedInBrowser(userId);

		const response = await browser.send(
			"GET",
			"/passkey/generate-register-options",
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			code: "PASSWORD_RESET_REQUIRED",
		});
	});

	it("refuses a session that must enroll in TOTP", async () => {
		const userId = await seedUser(db);
		await seedSettings(db, { mfaPolicy: "required" });
		const browser = await signedInBrowser(userId);

		const response = await browser.send(
			"GET",
			"/passkey/generate-register-options",
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			code: "MFA_ENROLLMENT_REQUIRED",
		});
	});
});

describe("sign-in", () => {
	it("issues a normal session to the passkey's user", async () => {
		const { key, userId } = await enroll();

		const { browser, response } = await signIn(key);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			user: { id: String(userId) },
		});
		expect(await db.select().from(authSessions)).toMatchObject([{ userId }]);
		expect(browser.has("__Secure-better-auth.session_token")).toBe(true);
	});

	it("scopes sign-in options to the configured RP", async () => {
		const response = await createBrowser().send(
			"GET",
			"/passkey/generate-authenticate-options",
		);

		expect(await response.json()).toMatchObject({
			rpId: RP_ID,
			userVerification: "preferred",
		});
	});

	it.each([
		["without user verification", { userVerified: false }],
		["from another origin", { origin: "https://evil.test" }],
		["for another RP ID", { rpId: "evil.test" }],
	])("refuses an assertion %s", async (_, ceremony) => {
		const { key } = await enroll();

		const { response } = await signIn(key, ceremony);

		expect(response.status).toBe(400);
		expect(await db.select().from(authSessions)).toEqual([]);
	});

	it("refuses an unknown credential", async () => {
		const { response } = await signIn(authenticator());

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: "PASSKEY_NOT_FOUND" });
	});

	it.each([
		["deactivated", { active: false }],
		["pending", { lifecycleState: "pending" as const, password: null }],
	])(
		"refuses a %s user with the invalid-credentials response",
		async (_, state) => {
			const { key, userId } = await enroll();
			await db.update(users).set(state).where(eq(users.id, userId));

			const { response } = await signIn(key);

			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({
				code: "INVALID_CREDENTIALS",
			});
			expect(await db.select().from(authSessions)).toEqual([]);
		},
	);

	it("refuses a replayed assertion", async () => {
		const { key } = await enroll();
		const browser = createBrowser();
		const options = await browser.send(
			"GET",
			"/passkey/generate-authenticate-options",
		);
		const body = { response: key.authenticate(await options.json()) };

		expect(
			(await browser.send("POST", "/passkey/verify-authentication", body))
				.status,
		).toBe(200);

		const replay = await browser.send(
			"POST",
			"/passkey/verify-authentication",
			body,
		);
		expect(replay.status).toBe(400);
		expect(await replay.json()).toMatchObject({ code: "CHALLENGE_NOT_FOUND" });
	});

	it("issues a TOTP-enrolled user a session without a second-factor step", async () => {
		const { key, userId } = await enroll();
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await db.insert(authTwoFactors).values({
			userId,
			secret: "encrypted-secret",
			backupCodes: "encrypted-codes",
			verified: true,
		});

		const { browser, response } = await signIn(key);

		expect(response.status).toBe(200);
		expect(await response.json()).not.toHaveProperty("twoFactorRedirect");
		expect(await db.select().from(authSessions)).toMatchObject([{ userId }]);
		expect(browser.has("__Secure-better-auth.session_token")).toBe(true);
		expect(browser.has("__Secure-better-auth.two_factor")).toBe(false);
	});

	it("restricts a user who must reset their password, as a password sign-in would", async () => {
		const { key, userId } = await enroll();
		await db
			.update(users)
			.set({ forceReset: true })
			.where(eq(users.id, userId));

		const { browser, response } = await signIn(key);
		expect(response.status).toBe(200);

		const restricted = await browser.send("POST", "/two-factor/disable", {});
		expect(restricted.status).toBe(403);
		expect(await restricted.json()).toMatchObject({
			code: "PASSWORD_RESET_REQUIRED",
		});
	});

	it("restricts a user the MFA policy requires to enroll, as a password sign-in would", async () => {
		const { key } = await enroll();
		await seedSettings(db, { mfaPolicy: "required" });

		const { browser } = await signIn(key);
		const restricted = await browser.send("POST", "/two-factor/disable", {});

		expect(restricted.status).toBe(403);
		expect(await restricted.json()).toMatchObject({
			code: "MFA_ENROLLMENT_REQUIRED",
		});
	});

	it.each([
		["GET", "/passkey/generate-authenticate-options"],
		["POST", "/passkey/verify-authentication"],
	] as const)(
		"refuses a fourth %s %s from one address within the window",
		async (method, path) => {
			const browser = createBrowser();
			const body = method === "POST" ? { response: {} } : undefined;
			for (let attempt = 0; attempt < 3; attempt++) {
				expect((await browser.send(method, path, body)).status).not.toBe(429);
			}

			const response = await browser.send(method, path, body);

			expect(response.status).toBe(429);
			expect(await db.select().from(authRateLimits)).toEqual([
				expect.objectContaining({ key: `${CLIENT_IP}|${path}`, count: 3 }),
			]);
		},
	);
});

describe("the mounted handler", () => {
	it.each([
		["GET", "/passkey/list-user-passkeys"],
		["POST", "/passkey/update-passkey"],
		["POST", "/passkey/delete-passkey"],
	] as const)("does not serve %s %s", async (method, path) => {
		const userId = await seedUser(db);
		const browser = await signedInBrowser(userId);

		const response = await browser.send(
			method,
			path,
			method === "POST" ? { id: "1", name: "Mine" } : undefined,
		);

		expect(response.status).toBe(404);
	});
});

describe("recent authentication", () => {
	const OPTIONS_PATH = RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH;
	const CHALLENGE_PATH = "/virtool-session/challenge";
	const STEP_UP_COOKIE = "__Secure-better-auth.step_up_passkey";

	async function stepUpOptions(browser: Browser) {
		const response = await browser.send("GET", OPTIONS_PATH);
		expect(response.status).toBe(200);
		return response.json();
	}

	async function stepUp(
		browser: Browser,
		key: ReturnType<typeof authenticator>,
		ceremony?: Parameters<typeof key.authenticate>[1],
	) {
		const body = {
			method: "passkey",
			response: key.authenticate(await stepUpOptions(browser), ceremony),
		};
		return { body, response: await browser.send("POST", CHALLENGE_PATH, body) };
	}

	it("asks only for the session user's passkeys, with user verification", async () => {
		const alice = await enroll({ handle: "alice" });
		await enroll({ handle: "bob" });
		const browser = await signedInBrowser(alice.userId);

		const options = await stepUpOptions(browser);

		expect(options).toMatchObject({
			rpId: RP_ID,
			userVerification: "required",
		});
		expect(options.allowCredentials).toEqual([
			expect.objectContaining({ id: alice.key.credentialId }),
		]);
		expect(browser.has(STEP_UP_COOKIE)).toBe(true);
	});

	it("refuses options to a user without a passkey", async () => {
		const userId = await seedUser(db);
		const browser = await signedInBrowser(userId);

		const response = await browser.send("GET", OPTIONS_PATH);

		expect(response.status).toBe(400);
		expect(await db.select().from(authVerifications)).toEqual([]);
	});

	it("refuses options without a session", async () => {
		const response = await createBrowser().send("GET", OPTIONS_PATH);

		expect(response.status).toBe(401);
	});

	it("accepts a verified assertion from the session user's passkey", async () => {
		const { key, userId } = await enroll();
		const browser = await signedInBrowser(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		const { response } = await stepUp(browser, key);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: true });
		expect(browser.has(STEP_UP_COOKIE)).toBe(false);
		expect(await db.select().from(authVerifications)).toEqual([]);
	});

	it("does not create a session", async () => {
		const { key, userId } = await enroll();
		const browser = await signedInBrowser(userId);

		await stepUp(browser, key);

		expect(await db.select().from(authSessions)).toHaveLength(1);
	});

	it("refuses a passkey that belongs to another user", async () => {
		const alice = await enroll({ handle: "alice" });
		const bob = await enroll({ handle: "bob" });
		const browser = await signedInBrowser(alice.userId);

		const { response } = await stepUp(browser, bob.key);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: "PASSKEY_CHALLENGE_FAILED",
		});
	});

	it("refuses options issued to another user's session", async () => {
		const alice = await enroll({ handle: "alice" });
		const bob = await enroll({ handle: "bob" });
		const aliceBrowser = await signedInBrowser(alice.userId);
		const bobBrowser = await signedInBrowser(bob.userId);
		const options = await stepUpOptions(bobBrowser);
		aliceBrowser.set(STEP_UP_COOKIE, bobBrowser.get(STEP_UP_COOKIE));

		const response = await aliceBrowser.send("POST", CHALLENGE_PATH, {
			method: "passkey",
			response: alice.key.authenticate(options),
		});

		expect(response.status).toBe(400);
	});

	it.each([
		["without user verification", { userVerified: false }],
		["from another origin", { origin: "https://evil.test" }],
		["for another RP ID", { rpId: "evil.test" }],
	])("refuses an assertion %s", async (_, ceremony) => {
		const { key, userId } = await enroll();
		const browser = await signedInBrowser(userId);

		const { response } = await stepUp(browser, key, ceremony);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: "PASSKEY_CHALLENGE_FAILED",
		});
	});

	it("consumes the challenge, so a replayed assertion is refused", async () => {
		const { key, userId } = await enroll();
		const browser = await signedInBrowser(userId);
		const options = await stepUpOptions(browser);
		const body = { method: "passkey", response: key.authenticate(options) };
		const token = browser.get(STEP_UP_COOKIE);

		expect((await browser.send("POST", CHALLENGE_PATH, body)).status).toBe(200);

		browser.set(STEP_UP_COOKIE, token);
		const replay = await browser.send("POST", CHALLENGE_PATH, body);
		expect(replay.status).toBe(400);
	});

	it("refuses an assertion without the options cookie", async () => {
		const { key, userId } = await enroll();
		const browser = await signedInBrowser(userId);
		const options = await stepUpOptions(browser);
		const unrelated = await signedInBrowser(userId);

		const response = await unrelated.send("POST", CHALLENGE_PATH, {
			method: "passkey",
			response: key.authenticate(options),
		});

		expect(response.status).toBe(400);
	});

	it("refuses options to a session that must reset its password", async () => {
		const { userId } = await enroll();
		await db
			.update(users)
			.set({ forceReset: true })
			.where(eq(users.id, userId));
		const browser = await signedInBrowser(userId);

		const response = await browser.send("GET", OPTIONS_PATH);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			code: "PASSWORD_RESET_REQUIRED",
		});
	});

	it("limits option requests from one address", async () => {
		const { userId } = await enroll();
		const browser = await signedInBrowser(userId);
		for (let attempt = 0; attempt < 5; attempt++) {
			expect((await browser.send("GET", OPTIONS_PATH)).status).toBe(200);
		}

		expect((await browser.send("GET", OPTIONS_PATH)).status).toBe(429);
	});
});
