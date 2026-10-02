import { hashPassword } from "@virtool/data/auth/password";
import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const ORIGIN = "http://localhost";

const cookies = new Map<string, string>();
const getRequest = vi.fn(
	() =>
		new Request(`${ORIGIN}/_serverFn/test`, {
			headers: {
				origin: ORIGIN,
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
const { sessionCookie, totp } = await import("../auth/test/fixtures");
const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;

const PASSWORD = "password_123";

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	auth = createAuth({
		db,
		publicOrigin: ORIGIN,
		webauthnRpId: "localhost",
		secret: "test-auth-secret-test-auth-secret",
	});
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	cookies.clear();
	vi.clearAllMocks();
	await db.delete(users);
});

async function signInMigratedUser() {
	const hashed = await hashPassword(PASSWORD);
	const userId = await seedUser(db, { password: hashed });
	const now = new Date();
	await db
		.update(users)
		.set({ authMigratedAt: now, username: "alice", displayUsername: "alice" })
		.where(eq(users.id, userId));
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: hashed.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});
	const session = await seedSession(db, userId, {
		expiresAt: new Date(Date.now() + 60 * 60_000),
	});
	const [name, value] = sessionCookie(session).split("=");
	cookies.set(name ?? "", value ?? "");
}

it("reports no recovery codes without TOTP", async () => {
	await signInMigratedUser();

	expect(await callServerFn(handlers, "getAccountSecurityFn")).toMatchObject({
		recoveryCodesRemaining: null,
		twoFactorEnabled: false,
	});
});

it("reports the number of recovery codes but never the codes", async () => {
	await signInMigratedUser();
	const { backupCodes, totpURI } = await auth.api.enableTwoFactor({
		headers: getRequest().headers,
		body: { password: PASSWORD },
	});
	await auth.api.verifyTOTP({
		headers: getRequest().headers,
		body: { code: totp(totpURI) },
	});

	const security = await callServerFn(handlers, "getAccountSecurityFn");

	expect(security).toMatchObject({
		recoveryCodesRemaining: backupCodes.length,
		twoFactorEnabled: true,
	});
	const serialized = JSON.stringify(security);
	for (const code of backupCodes) {
		expect(serialized).not.toContain(code);
	}
});
