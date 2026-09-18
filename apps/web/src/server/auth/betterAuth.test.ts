import type { AccountLifecycleState } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts, authSessions } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	AUTH_BASE_PATH,
	createAuth,
	createAuthRequestHandler,
} from "./betterAuth";
import { SESSION_FRESH_AGE_SECONDS } from "./freshness";

const ORIGIN = "https://virtool.test";

/**
 * A `$2b$12$` hash copied out of a production-shaped `users.password`, of the
 * password below. Written as a literal rather than produced by `hashPassword`
 * so this proves Better Auth verifies *stored* bytes, not bytes it just made.
 */
const LEGACY_HASH =
	"$2b$12$YZZHj6hv6jXthfSY0zt8oO0Sk47cjiLCTP.sQHRBYQJVJZ0ALjsxu";

const LEGACY_PASSWORD = "correct-horse-battery-staple";

let database: TestDatabase;
let db: Db;
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: ORIGIN,
		webauthnRpId: "virtool.test",
		secret: "test-auth-secret-test-auth-secret",
	});
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(users);
});

function post(path: string, body: unknown, origin = ORIGIN): Request {
	return new Request(`${ORIGIN}${AUTH_BASE_PATH}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin,
			// Better Auth validates the origin only on a request that carries
			// cookies; a request without them is a first login, checked instead
			// through Sec-Fetch metadata. A cross-site POST from a browser that
			// already holds a session is the case worth pinning, and it always
			// carries this.
			cookie: "vt-test=1",
		},
		body: JSON.stringify(body),
	});
}

/**
 * Seed a user the way the legacy migration will: the Virtool row, plus one
 * `credential` account carrying the bcrypt hash verbatim.
 */
async function seedMigratedUser(
	hash = LEGACY_HASH,
	state: {
		active?: boolean;
		forceReset?: boolean;
		lifecycleState?: AccountLifecycleState;
	} = {},
): Promise<number> {
	// A pending row carries no legacy password — `pending_has_no_password`
	// refuses the pair — so the credential exists only on the Better Auth side,
	// which is the state a half-finished completion would leave behind.
	const pending = state.lifecycleState === "pending";
	const [user] = await db
		.insert(users)
		.values({
			handle: "Alice",
			username: "alice",
			displayUsername: "Alice",
			name: "Alice",
			email: "alice@virtool.test",
			password: pending ? null : Buffer.from(hash, "utf8"),
			lastPasswordChange: new Date(),
			settings: {},
			active: state.active ?? true,
			forceReset: state.forceReset ?? false,
			lifecycleState: state.lifecycleState ?? "normal",
		})
		.returning({ id: users.id });

	const userId = (user as { id: number }).id;

	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: hash,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return userId;
}

describe("legacy bcrypt credentials", () => {
	it("configures the explicit recent-authentication window", () => {
		expect(auth.options.session?.freshAge).toBe(SESSION_FRESH_AGE_SECONDS);
	});

	it("authenticates a copied production hash without rehashing it", async () => {
		const userId = await seedMigratedUser();

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(200);

		// The session is Better Auth's own table, keyed to the integer users.id.
		const [session] = await db
			.select({
				userId: authSessions.userId,
				createdAt: authSessions.createdAt,
				expiresAt: authSessions.expiresAt,
			})
			.from(authSessions);

		expect(session?.userId).toBe(userId);
		expect(
			(session?.expiresAt.getTime() ?? 0) - (session?.createdAt.getTime() ?? 0),
		).toBeCloseTo(7 * 24 * 60 * 60_000, -2);

		// Verification must not rewrite the stored hash.
		const [account] = await db
			.select({ password: authAccounts.password })
			.from(authAccounts)
			.where(eq(authAccounts.userId, userId));

		expect(account?.password).toBe(LEGACY_HASH);
	});

	it("matches the handle case-insensitively", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "ALICE",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(200);
	});

	it("refuses the wrong password", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/sign-in/username", { username: "alice", password: "wrong" }),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	it("refuses a corrupt hash without saying the account exists", async () => {
		await seedMigratedUser("not-a-bcrypt-hash");

		const corrupt = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		const missing = await auth.handler(
			post("/sign-in/username", {
				username: "nobody",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(corrupt.status).toBe(401);
		expect(corrupt.status).toBe(missing.status);
		expect(await corrupt.text()).toBe(await missing.text());
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});
});

describe("the mounted handler", () => {
	it("blocks Better Auth account operations for a forced-reset session", async () => {
		await seedMigratedUser(LEGACY_HASH, { forceReset: true });
		const signInResponse = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);
		const cookie = signInResponse.headers.get("set-cookie")?.split(";", 1)[0];
		expect(cookie).toBeDefined();

		const handler = createAuthRequestHandler(db, auth);
		const response = await handler(
			new Request(`${ORIGIN}${AUTH_BASE_PATH}/change-password`, {
				method: "POST",
				headers: { cookie: cookie as string, origin: ORIGIN },
				body: JSON.stringify({
					currentPassword: LEGACY_PASSWORD,
					newPassword: "new-password-123",
				}),
			}),
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			code: "PASSWORD_RESET_REQUIRED",
			message: "Password reset required",
		});
	});

	it("refuses public sign-up", async () => {
		const response = await auth.handler(
			post("/sign-up/email", {
				email: "mallory@virtool.test",
				password: LEGACY_PASSWORD,
				name: "Mallory",
			}),
		);

		expect(response.status).not.toBe(200);
		expect(await db.select().from(users)).toHaveLength(0);
	});

	it("refuses a cross-origin request from a cookie-bearing browser", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post(
				"/sign-in/username",
				{ username: "alice", password: LEGACY_PASSWORD },
				"https://phishing.example",
			),
		);

		expect(response.status).toBe(403);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	it("answers 404 on an unknown path rather than falling through", async () => {
		const response = await auth.handler(
			new Request(`${ORIGIN}${AUTH_BASE_PATH}/not-a-real-endpoint`, {
				method: "GET",
			}),
		);

		expect(response.status).toBe(404);
	});

	it("refuses an unsupported method", async () => {
		const response = await auth.handler(
			new Request(`${ORIGIN}${AUTH_BASE_PATH}/sign-in/username`, {
				method: "GET",
			}),
		);

		expect(response.status).toBe(404);
	});

	it("sets the session cookie http-only, secure and same-site lax", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		const cookie = response.headers.get("set-cookie");

		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("SameSite=Lax");
	});
});

describe("step-up session replacement", () => {
	async function signInForReplacement() {
		await seedMigratedUser();
		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);
		const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
		if (!cookie) {
			throw new Error("sign-in did not set a session cookie");
		}
		const [session] = await db.select().from(authSessions);
		if (!session) {
			throw new Error("sign-in did not create a session");
		}
		return { cookie, session };
	}

	it("creates a fresh replacement and revokes the old session", async () => {
		const { cookie, session: oldSession } = await signInForReplacement();

		const result = await auth.api.createStepUpSession({
			headers: new Headers({ cookie, origin: ORIGIN }),
			returnHeaders: true,
		});
		const sessions = await db.select().from(authSessions);

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.id).toBe(Number(result.response.sessionId));
		expect(sessions[0]?.id).not.toBe(oldSession.id);
		expect(sessions[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(
			oldSession.createdAt.getTime(),
		);
		expect(sessions[0]?.ipAddress).toBe(oldSession.ipAddress);
		expect(sessions[0]?.userAgent).toBe(oldSession.userAgent);
		expect(result.headers.get("set-cookie")).toContain(
			"better-auth.session_token=",
		);
	});

	it("replaces a valid session older than the freshness window", async () => {
		const { cookie, session: oldSession } = await signInForReplacement();
		const staleCreatedAt = new Date(
			Date.now() - (SESSION_FRESH_AGE_SECONDS + 1) * 1000,
		);
		await db
			.update(authSessions)
			.set({ createdAt: staleCreatedAt })
			.where(eq(authSessions.id, oldSession.id));

		const result = await auth.api.createStepUpSession({
			headers: new Headers({ cookie, origin: ORIGIN }),
		});

		expect(Number(result.sessionId)).not.toBe(oldSession.id);
		expect(await db.select().from(authSessions)).toHaveLength(1);
	});

	it("keeps exactly one durable winner across concurrent replacements", async () => {
		const { cookie, session: oldSession } = await signInForReplacement();
		const headers = new Headers({ cookie, origin: ORIGIN });

		const results = await Promise.allSettled([
			auth.api.createStepUpSession({ headers }),
			auth.api.createStepUpSession({ headers }),
		]);
		const sessions = await db.select().from(authSessions);

		expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
			1,
		);
		expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
			1,
		);
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.id).not.toBe(oldSession.id);
	});
});

describe("virtool account state", () => {
	it("refuses a deactivated user with the wrong-password response", async () => {
		await seedMigratedUser(LEGACY_HASH, { active: false });

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	// A completion transaction moves the account out of `pending` before its
	// caller mints any session, so an ordinary session can only ever be issued
	// to an account that is already eligible for one.
	it("refuses an account that has not completed setup", async () => {
		await seedMigratedUser(LEGACY_HASH, { lifecycleState: "pending" });

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	it("issues a session to a user whose password-reset restriction is enforced by policy", async () => {
		await seedMigratedUser(LEGACY_HASH, { forceReset: true });

		const response = await auth.handler(
			post("/sign-in/username", {
				username: "alice",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(200);
		expect(await db.select().from(authSessions)).toHaveLength(1);
	});
});

describe("email sign-in", () => {
	it("is not mounted, because users.email is not unique", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/sign-in/email", {
				email: "alice@virtool.test",
				password: LEGACY_PASSWORD,
			}),
		);

		expect(response.status).toBe(404);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});
});

describe("the username availability endpoint", () => {
	it("is not mounted, so it cannot enumerate handles", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/is-username-available", { username: "alice" }),
		);

		expect(response.status).toBe(404);
	});
});

describe("the user update endpoint", () => {
	it("is not mounted, so username cannot drift from handle", async () => {
		await seedMigratedUser();

		const response = await auth.handler(
			post("/update-user", { username: "someone-else" }),
		);

		expect(response.status).toBe(404);
	});
});

describe("the integer user id", () => {
	it("leaves users.id to the identity column", async () => {
		const first = await seedMigratedUser();

		await db.delete(users);

		const second = await seedMigratedUser();

		expect(typeof first).toBe("number");
		expect(second).toBeGreaterThan(first);
	});
});
