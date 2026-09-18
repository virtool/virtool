import { emptyPermissions } from "@virtool/contracts";
import { createAuthenticatedSession } from "@virtool/data/auth/session";
import {
	seedApiKey,
	seedSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } from "./cookies";
import {
	parseBasicAuthHeader,
	parseCookieHeader,
	verifyApiKey,
	verifyBrowserPrincipal,
	verifyLegacyBrowserPrincipal,
} from "./verify";

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
	await db.delete(apiKeys);
	await db.delete(users);
});

describe("verifyBrowserPrincipal", () => {
	it("maps an active Better Auth session to numeric Virtool ids", async () => {
		const userId = await seedUser(db);
		const seeded = await seedSession(db, userId);
		const resolve = vi.fn().mockResolvedValue({
			session: { id: String(seeded.sessionId) },
			user: { id: String(userId) },
		});

		await expect(
			verifyBrowserPrincipal(db, new Request("https://virtool.test/"), resolve),
		).resolves.toMatchObject({
			kind: "browser",
			sessionId: seeded.sessionId,
			sessionStore: "better_auth",
			userId,
		});
	});

	it("classifies a forced-reset user without widening their authority", async () => {
		const userId = await seedUser(db, { forceReset: true });
		const seeded = await seedSession(db, userId);
		const resolve = vi.fn().mockResolvedValue({
			session: { id: seeded.sessionId },
			user: { id: userId },
		});

		await expect(
			verifyBrowserPrincipal(db, new Request("https://virtool.test/"), resolve),
		).resolves.toMatchObject({
			kind: "password_reset",
			sessionId: seeded.sessionId,
			sessionStore: "better_auth",
			userId,
		});
	});

	it.each([
		["malformed user", { session: { id: 1 }, user: { id: "alice" } }],
		["malformed session", { session: { id: "token" }, user: { id: 1 } }],
	])("rejects a %s identity", async (_label, resolved) => {
		await expect(
			verifyBrowserPrincipal(
				db,
				new Request("https://virtool.test/"),
				vi.fn().mockResolvedValue(resolved),
			),
		).resolves.toBeNull();
	});

	it("rejects a deactivated user on every request", async () => {
		const userId = await seedUser(db, { active: false });
		await expect(
			verifyBrowserPrincipal(
				db,
				new Request("https://virtool.test/"),
				vi.fn().mockResolvedValue({
					session: { id: 1 },
					user: { id: userId },
				}),
			),
		).resolves.toBeNull();
	});

	it("propagates provider failures", async () => {
		await expect(
			verifyBrowserPrincipal(
				db,
				new Request("https://virtool.test/"),
				vi.fn().mockRejectedValue(new Error("database unavailable")),
			),
		).rejects.toThrow("database unavailable");
	});
});

describe("verifyLegacyBrowserPrincipal", () => {
	it("accepts a retained legacy session", async () => {
		const userId = await seedUser(db);
		const session = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		const request = new Request("https://virtool.test/", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${session.sessionId}; ${SESSION_TOKEN_COOKIE}=${session.token}`,
			},
		});

		await expect(
			verifyLegacyBrowserPrincipal(db, request),
		).resolves.toMatchObject({
			kind: "browser",
			sessionId: session.row.id,
			sessionStore: "legacy",
			userId,
		});
	});

	it("rejects a wrong retained legacy token", async () => {
		const userId = await seedUser(db);
		const session = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		const request = new Request("https://virtool.test/", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${session.sessionId}; ${SESSION_TOKEN_COOKIE}=wrong`,
			},
		});

		await expect(verifyLegacyBrowserPrincipal(db, request)).resolves.toBeNull();
	});
});

describe("verifyApiKey", () => {
	it("returns a discriminated principal with the stable key id", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId, { upload_file: true });
		const [row] = await db.select({ id: apiKeys.id }).from(apiKeys);

		await expect(verifyApiKey(db, "ALICE", key)).resolves.toEqual({
			kind: "api_key",
			keyId: row?.id,
			permissions: { ...emptyPermissions(), upload_file: true },
			userId,
		});
	});

	it("rejects invalid, inactive, and job-prefixed callers", async () => {
		const userId = await seedUser(db, { active: false });
		const key = await seedApiKey(db, userId);
		expect(await verifyApiKey(db, "alice", key)).toBeNull();
		expect(await verifyApiKey(db, "jobs", key)).toBeNull();
		expect(await verifyApiKey(db, "alice", "wrong")).toBeNull();
	});
});

describe("parsers", () => {
	it("parses cookies and Basic credentials", () => {
		expect(parseCookieHeader("a=1; b=two%20words")).toEqual({
			a: "1",
			b: "two words",
		});
		expect(
			parseBasicAuthHeader(
				`Basic ${Buffer.from("alice:key").toString("base64")}`,
			),
		).toEqual({ handle: "alice", key: "key" });
	});

	it("rejects malformed Basic credentials", () => {
		expect(parseBasicAuthHeader("Bearer token")).toBeNull();
		expect(parseBasicAuthHeader("Basic !!!!")).toBeNull();
	});
});
