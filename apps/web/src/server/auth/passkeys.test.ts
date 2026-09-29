import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import {
	authPasskeys,
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
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	AUTH_BASE_PATH,
	createAuth,
	createAuthRequestHandler,
	PASSKEY_SIGN_IN_PATH,
	withPasskeyTwoFactor,
} from "./betterAuth";
import { SESSION_FRESH_AGE_SECONDS } from "./freshness";
import { sessionCookie } from "./test/fixtures";
import { createSoftwareAuthenticator } from "./test/webauthn";

const ORIGIN = "https://virtool.test";
const RP_ID = "virtool.test";

let database: TestDatabase;
let db: Db;
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: ORIGIN,
		webauthnRpId: RP_ID,
		secret: "test-auth-secret-test-auth-secret",
	});
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await Promise.all([
		db.delete(users),
		db.delete(authVerifications),
		db.delete(settings),
	]);
});

/** A minimal cookie jar that keeps the latest value of each cookie. */
function createJar(initial?: string) {
	const cookies = new Map<string, string>();

	function add(pair: string) {
		const [name, ...rest] = pair.split("=");
		if (name) {
			cookies.set(name.trim(), rest.join("="));
		}
	}

	if (initial) {
		add(initial);
	}

	return {
		store(headers: Headers) {
			for (const cookie of headers.getSetCookie()) {
				const [pair] = cookie.split(";", 1);
				if (pair) {
					add(pair);
				}
			}
		},
		has(name: string) {
			return (cookies.get(name) ?? "") !== "";
		},
		headers() {
			return new Headers({
				"content-type": "application/json",
				origin: ORIGIN,
				cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
			});
		},
	};
}

async function signedInJar(userId: number, createdAt = new Date()) {
	const session = await seedSession(db, userId, {
		createdAt,
		expiresAt: new Date(Date.now() + 60 * 60_000),
	});
	// An https base URL gives every Better Auth cookie the `__Secure-` prefix.
	return createJar(`__Secure-${sessionCookie(session)}`);
}

function authenticator() {
	return createSoftwareAuthenticator({ origin: ORIGIN, rpId: RP_ID });
}

async function registrationOptions(jar: ReturnType<typeof createJar>) {
	const result = await auth.api.generatePasskeyRegistrationOptions({
		headers: jar.headers(),
		returnHeaders: true,
	});
	jar.store(result.headers);
	return result.response;
}

async function register(
	userId: number,
	key = authenticator(),
	ceremony?: Parameters<typeof key.register>[1],
) {
	const jar = await signedInJar(userId);
	const options = await registrationOptions(jar);
	return auth.api.verifyPasskeyRegistration({
		headers: jar.headers(),
		body: { response: key.register(options, ceremony) },
	});
}

async function signIn(
	key: ReturnType<typeof authenticator>,
	ceremony?: Parameters<typeof key.authenticate>[1],
) {
	const jar = createJar();
	const options = await auth.api.generatePasskeyAuthenticationOptions({
		headers: jar.headers(),
		returnHeaders: true,
	});
	jar.store(options.headers);
	const result = await auth.api.verifyPasskeyAuthentication({
		headers: jar.headers(),
		body: { response: key.authenticate(options.response, ceremony) },
		returnHeaders: true,
	});
	jar.store(result.headers);
	return { jar, response: result.response };
}

async function passkeyRows() {
	return db.select().from(authPasskeys);
}

describe("registration", () => {
	it("asks for a verified, discoverable credential scoped to the configured RP", async () => {
		const userId = await seedUser(db);
		const options = await registrationOptions(await signedInJar(userId));

		expect(options.rp).toEqual({ id: RP_ID, name: "Virtool" });
		expect(options.authenticatorSelection).toMatchObject({
			residentKey: "required",
			userVerification: "required",
		});
	});

	it("stores the public credential against the integer user", async () => {
		const userId = await seedUser(db);
		const key = authenticator();

		await register(userId, key);

		expect(await passkeyRows()).toMatchObject([
			{
				userId,
				credentialID: key.credentialId,
				name: "Passkey",
				deviceType: "multiDevice",
				backedUp: true,
			},
		]);
	});

	it("refuses a credential the authenticator did not verify the user for", async () => {
		const userId = await seedUser(db);

		await expect(
			register(userId, authenticator(), { userVerified: false }),
		).rejects.toMatchObject({
			body: { code: "USER_VERIFICATION_REQUIRED" },
		});
		expect(await passkeyRows()).toEqual([]);
	});

	it.each([
		["another origin", { origin: "https://evil.test" }],
		["another RP ID", { rpId: "evil.test" }],
	])("refuses a response bound to %s", async (_, ceremony) => {
		const userId = await seedUser(db);

		await expect(
			register(userId, authenticator(), ceremony),
		).rejects.toMatchObject({
			body: { code: "FAILED_TO_VERIFY_REGISTRATION" },
		});
		expect(await passkeyRows()).toEqual([]);
	});

	it("consumes the challenge, so a replayed response is refused", async () => {
		const userId = await seedUser(db);
		const jar = await signedInJar(userId);
		const options = await registrationOptions(jar);
		const response = authenticator().register(options);

		await auth.api.verifyPasskeyRegistration({
			headers: jar.headers(),
			body: { response },
		});

		await expect(
			auth.api.verifyPasskeyRegistration({
				headers: jar.headers(),
				body: { response },
			}),
		).rejects.toMatchObject({ body: { code: "CHALLENGE_NOT_FOUND" } });
		expect(await passkeyRows()).toHaveLength(1);
	});

	it("lets one of two concurrent completions win", async () => {
		const userId = await seedUser(db);
		const jar = await signedInJar(userId);
		const options = await registrationOptions(jar);
		const response = authenticator().register(options);

		const results = await Promise.allSettled(
			[0, 1].map(() =>
				auth.api.verifyPasskeyRegistration({
					headers: jar.headers(),
					body: { response },
				}),
			),
		);

		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect(await passkeyRows()).toHaveLength(1);
	});

	it("refuses a credential id another user already holds", async () => {
		const alice = await seedUser(db, { handle: "alice" });
		const bob = await seedUser(db, { handle: "bob" });
		const credentialId = new Uint8Array(32).fill(7);

		await register(
			alice,
			createSoftwareAuthenticator({
				origin: ORIGIN,
				rpId: RP_ID,
				credentialId,
			}),
		);

		await expect(
			register(
				bob,
				createSoftwareAuthenticator({
					origin: ORIGIN,
					rpId: RP_ID,
					credentialId,
				}),
			),
		).rejects.toMatchObject({ body: { code: "PASSKEY_ALREADY_REGISTERED" } });
		expect(await passkeyRows()).toMatchObject([{ userId: alice }]);
	});

	it("refuses to start from a session older than the freshness window", async () => {
		const userId = await seedUser(db);
		const jar = await signedInJar(
			userId,
			new Date(Date.now() - SESSION_FRESH_AGE_SECONDS * 1000 - 1000),
		);

		await expect(registrationOptions(jar)).rejects.toMatchObject({
			body: { code: "SESSION_NOT_FRESH" },
		});
	});
});

describe("sign-in", () => {
	it("issues a normal session to the passkey's user", async () => {
		const userId = await seedUser(db);
		const key = authenticator();
		await register(userId, key);
		await db.delete(authSessions);

		const { jar, response } = await signIn(key);

		expect(response).toMatchObject({ user: { id: String(userId) } });
		expect(await db.select().from(authSessions)).toMatchObject([{ userId }]);
		expect(jar.has("__Secure-better-auth.session_token")).toBe(true);
	});

	it("scopes sign-in options to the configured RP", async () => {
		const options = await auth.api.generatePasskeyAuthenticationOptions({
			headers: createJar().headers(),
		});

		expect(options.rpId).toBe(RP_ID);
	});

	it.each([
		["without user verification", { userVerified: false }],
		["from another origin", { origin: "https://evil.test" }],
		["for another RP ID", { rpId: "evil.test" }],
	])("refuses an assertion %s", async (_, ceremony) => {
		const userId = await seedUser(db);
		const key = authenticator();
		await register(userId, key);
		await db.delete(authSessions);

		await expect(signIn(key, ceremony)).rejects.toMatchObject({
			statusCode: 400,
		});
		expect(await db.select().from(authSessions)).toEqual([]);
	});

	it("refuses an unknown credential", async () => {
		await expect(signIn(authenticator())).rejects.toMatchObject({
			body: { code: "PASSKEY_NOT_FOUND" },
		});
	});

	it.each([
		["deactivated", { active: false }],
		["pending", { lifecycleState: "pending" as const, password: null }],
	])(
		"refuses a %s user with the invalid-credentials response",
		async (_, state) => {
			const userId = await seedUser(db);
			const key = authenticator();
			await register(userId, key);
			await db.delete(authSessions);
			await db.update(users).set(state).where(eq(users.id, userId));

			await expect(signIn(key)).rejects.toMatchObject({
				body: { code: "INVALID_CREDENTIALS" },
			});
			expect(await db.select().from(authSessions)).toEqual([]);
		},
	);

	it("refuses a replayed assertion", async () => {
		const userId = await seedUser(db);
		const key = authenticator();
		await register(userId, key);

		const jar = createJar();
		const options = await auth.api.generatePasskeyAuthenticationOptions({
			headers: jar.headers(),
			returnHeaders: true,
		});
		jar.store(options.headers);
		const response = key.authenticate(options.response);
		await auth.api.verifyPasskeyAuthentication({
			headers: jar.headers(),
			body: { response },
		});

		await expect(
			auth.api.verifyPasskeyAuthentication({
				headers: jar.headers(),
				body: { response },
			}),
		).rejects.toMatchObject({ body: { code: "CHALLENGE_NOT_FOUND" } });
	});

	it("sends a TOTP-enrolled user to the second-factor step without a session", async () => {
		const userId = await seedUser(db);
		const key = authenticator();
		await register(userId, key);
		await db.delete(authSessions);
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

		const { jar, response } = await signIn(key);

		expect(response).toMatchObject({ twoFactorRedirect: true });
		expect(await db.select().from(authSessions)).toEqual([]);
		expect(jar.has("__Secure-better-auth.session_token")).toBe(false);
		expect(jar.has("__Secure-better-auth.two_factor")).toBe(true);
	});

	it("restricts a user the MFA policy requires to enroll, as a password sign-in would", async () => {
		const userId = await seedUser(db);
		const key = authenticator();
		await register(userId, key);
		await db.delete(authSessions);
		await seedSettings(db, { mfaPolicy: "required" });

		const { jar } = await signIn(key);
		const response = await createAuthRequestHandler(
			db,
			auth,
		)(
			new Request(`${ORIGIN}${AUTH_BASE_PATH}/two-factor/disable`, {
				method: "POST",
				headers: jar.headers(),
				body: "{}",
			}),
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			code: "MFA_ENROLLMENT_REQUIRED",
		});
	});
});

describe("the mounted handler", () => {
	it.each([
		["GET", "/passkey/generate-register-options"],
		["POST", "/passkey/verify-registration"],
		["GET", "/passkey/generate-authenticate-options"],
		["POST", "/passkey/verify-authentication"],
		["GET", "/passkey/list-user-passkeys"],
		["POST", "/passkey/update-passkey"],
		["POST", "/passkey/delete-passkey"],
	])("does not serve %s %s", async (method, path) => {
		const userId = await seedUser(db);
		const jar = await signedInJar(userId);

		const response = await createAuthRequestHandler(
			db,
			auth,
		)(
			new Request(`${ORIGIN}${AUTH_BASE_PATH}${path}`, {
				method,
				headers: jar.headers(),
				body: method === "POST" ? JSON.stringify({ id: "1" }) : undefined,
			}),
		);

		expect(response.status).toBe(404);
	});
});

describe("withPasskeyTwoFactor", () => {
	function decoys() {
		return twoFactor().hooks.after.map((hook) => ({
			...hook,
			matcher: () => false,
		}));
	}

	function passkeyHook(plugin: ReturnType<typeof twoFactor>) {
		return plugin.hooks.after.find((hook) =>
			hook.matcher({ path: PASSKEY_SIGN_IN_PATH } as never),
		);
	}

	it("reuses the sign-in hook wherever the plugin lists it", () => {
		const plugin = twoFactor();
		const [signIn] = plugin.hooks.after;
		plugin.hooks.after.unshift(...decoys());

		expect(passkeyHook(withPasskeyTwoFactor(plugin))?.handler).toBe(
			signIn?.handler,
		);
	});

	it("fails at startup when no hook matches sign-in", () => {
		const plugin = twoFactor();
		plugin.hooks.after.splice(0, plugin.hooks.after.length, ...decoys());

		expect(() => withPasskeyTwoFactor(plugin)).toThrow(
			"Expected one Better Auth two-factor sign-in hook, found 0",
		);
	});

	it("fails at startup when more than one hook matches sign-in", () => {
		const plugin = twoFactor();
		plugin.hooks.after.push(...twoFactor().hooks.after);

		expect(() => withPasskeyTwoFactor(plugin)).toThrow(
			"Expected one Better Auth two-factor sign-in hook, found 2",
		);
	});
});
