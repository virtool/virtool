import { emptyPermissions, type Permissions } from "@virtool/contracts";
import {
	createAuthenticatedSession,
	createResetSession,
} from "@virtool/data/auth/session";
import {
	seedApiKey,
	seedSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import { newSessionToken } from "@virtool/data/auth/tokens";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessionCookie } from "./test/fixtures";
import {
	parseBasicAuthHeader,
	parseCookieHeader,
	verifyApiKey,
	verifyAuthenticatedSession,
	verifyRequest,
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
	await db.delete(sessions);
	await db.delete(users);
});

describe("verifyAuthenticatedSession", () => {
	it("resolves the session of an active user", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toEqual({
			userId,
		});
	});

	it("rejects a session whose user has been deactivated", async () => {
		const userId = await seedUser(db, { active: false });
		const { sessionId, token } = await seedSession(db, userId);

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it("rejects a session deactivated after it was issued", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toEqual({
			userId,
		});

		await db.update(users).set({ active: false });

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it.each([
		["no session id", undefined, "token"],
		["no session token", "session_abc", undefined],
	])("rejects when there is %s", async (_label, sessionId, token) => {
		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it("rejects an unknown session id", async () => {
		const userId = await seedUser(db);
		const { token } = await seedSession(db, userId);

		expect(
			await verifyAuthenticatedSession(db, "session_unknown", token),
		).toBeNull();
	});

	it("rejects a reset session", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId, {
			sessionType: "reset",
		});

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it("rejects a session with no stored token hash", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId, {
			withToken: false,
		});

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it("rejects an expired session", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId, {
			expiresAt: new Date(Date.now() - 1_000),
		});

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toBeNull();
	});

	it("rejects a token that does not match the stored hash", async () => {
		const userId = await seedUser(db);
		const { sessionId } = await seedSession(db, userId);

		expect(
			await verifyAuthenticatedSession(db, sessionId, newSessionToken()),
		).toBeNull();
	});

	// The two below pair `createAuthenticatedSession` and `createResetSession`
	// with the verifier rather than with the fixture, which is the only way to
	// catch the two drifting on what a session row has to look like.
	it("accepts a session minted by createAuthenticatedSession", async () => {
		const userId = await seedUser(db);

		const { sessionId, token } = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(await verifyAuthenticatedSession(db, sessionId, token)).toEqual({
			userId,
		});
	});

	it("rejects a reset session presented as an authenticated one", async () => {
		const userId = await seedUser(db);

		const { sessionId, resetCode } = await createResetSession(db, {
			userId,
			ip: "127.0.0.1",
			remember: false,
		});

		expect(
			await verifyAuthenticatedSession(db, sessionId, resetCode),
		).toBeNull();
	});
});

describe("parseCookieHeader", () => {
	it("returns nothing for a request that sent no cookie header", () => {
		expect(parseCookieHeader(null)).toEqual({});
	});

	it("parses a pair of cookies", () => {
		expect(parseCookieHeader("session_id=abc; session_token=def")).toEqual({
			session_id: "abc",
			session_token: "def",
		});
	});

	it("trims the whitespace around names and values", () => {
		expect(parseCookieHeader("  session_id  =  abc  ")).toEqual({
			session_id: "abc",
		});
	});

	it("decodes a percent-encoded value", () => {
		expect(parseCookieHeader("session_id=a%20b%3Bc")).toEqual({
			session_id: "a b;c",
		});
	});

	// Splitting on the last `=` would corrupt any base64-padded value.
	it("splits on the first equals sign only", () => {
		expect(parseCookieHeader("session_token=aGk=")).toEqual({
			session_token: "aGk=",
		});
	});

	it("skips segments with no equals sign", () => {
		expect(parseCookieHeader("broken; session_id=abc")).toEqual({
			session_id: "abc",
		});
	});

	it("skips a segment with an empty name", () => {
		expect(parseCookieHeader("=orphan; session_id=abc")).toEqual({
			session_id: "abc",
		});
	});

	it("keeps a cookie with an empty value", () => {
		expect(parseCookieHeader("session_id=")).toEqual({ session_id: "" });
	});
});

describe("parseBasicAuthHeader", () => {
	function encode(value: string): string {
		return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
	}

	it("parses a handle and key", () => {
		expect(parseBasicAuthHeader(encode("alice:secret"))).toEqual({
			handle: "alice",
			key: "secret",
		});
	});

	it("accepts the scheme in any case", () => {
		expect(
			parseBasicAuthHeader(encode("alice:secret").replace("Basic", "bAsIc")),
		).toEqual({ handle: "alice", key: "secret" });
	});

	// A key is hex today, but nothing stops a colon appearing in one later.
	it("splits on the first colon only", () => {
		expect(parseBasicAuthHeader(encode("alice:a:b"))).toEqual({
			handle: "alice",
			key: "a:b",
		});
	});

	// RFC 7235 allows more than one space between the scheme and the credentials.
	it.each([
		["extra spaces between the scheme and credentials", "   "],
		["a tab", "\t"],
	])("accepts %s", (_label, separator) => {
		expect(
			parseBasicAuthHeader(encode("alice:secret").replace(" ", separator)),
		).toEqual({ handle: "alice", key: "secret" });
	});

	it("accepts a header padded with surrounding whitespace", () => {
		expect(parseBasicAuthHeader(`  ${encode("alice:secret")}  `)).toEqual({
			handle: "alice",
			key: "secret",
		});
	});

	it.each([
		["a bearer token", "Bearer abcdef"],
		["no encoded credentials", "Basic"],
		["trailing junk", `${encode("alice:secret")} extra`],
		["no colon", encode("alice")],
		["an empty handle", encode(":secret")],
		["an empty string", ""],
		["only whitespace", "   "],
	])("rejects %s", (_label, header) => {
		expect(parseBasicAuthHeader(header)).toBeNull();
	});
});

describe("verifyApiKey", () => {
	it("resolves the key owner and the key's permissions", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId, { upload_file: true });

		expect(await verifyApiKey(db, "alice", key)).toEqual({
			userId,
			keyPermissions: { ...emptyPermissions(), upload_file: true },
		});
	});

	it("matches the handle case-insensitively", async () => {
		const userId = await seedUser(db, { handle: "Alice" });
		const key = await seedApiKey(db, userId);

		expect(await verifyApiKey(db, "aLiCe", key)).toMatchObject({ userId });
	});

	it("expands a partially stored permission set", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId);
		await db.update(apiKeys).set({
			// Keys written by the legacy Python path stored only granted names.
			permissions: { upload_file: true } as unknown as Permissions,
		});

		expect(await verifyApiKey(db, "alice", key)).toEqual({
			userId,
			keyPermissions: { ...emptyPermissions(), upload_file: true },
		});
	});

	it("rejects an unknown handle", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId);

		expect(await verifyApiKey(db, "nobody", key)).toBeNull();
	});

	it("rejects a deactivated user", async () => {
		const userId = await seedUser(db, { active: false });
		const key = await seedApiKey(db, userId);

		expect(await verifyApiKey(db, "alice", key)).toBeNull();
	});

	it("rejects a key that is not the named user's", async () => {
		const other = await seedUser(db, { handle: "bob" });
		await seedUser(db, { handle: "alice" });
		const key = await seedApiKey(db, other);

		expect(await verifyApiKey(db, "alice", key)).toBeNull();
	});

	it("rejects an unknown key", async () => {
		await seedUser(db);

		expect(await verifyApiKey(db, "alice", "not-a-key")).toBeNull();
	});

	// Job keys authenticate against a separate service, and Python refuses them
	// here rather than resolving `job-{id}` as a user handle.
	it("rejects a job-prefixed login without touching the database", async () => {
		const userId = await seedUser(db, { handle: "jobs" });
		const key = await seedApiKey(db, userId);

		expect(await verifyApiKey(db, "jobs", key)).toBeNull();
	});

	// The handle lookup is case-insensitive, so a guard that was not would let
	// `JOBS` through to the row that `jobs` is refused.
	it("rejects a job-prefixed login whatever its case", async () => {
		const userId = await seedUser(db, { handle: "jobs" });
		const key = await seedApiKey(db, userId);

		expect(await verifyApiKey(db, "JOBS", key)).toBeNull();
		expect(await verifyApiKey(db, "JoBs", key)).toBeNull();
	});
});

describe("verifyRequest", () => {
	function request(cookie: string): Request {
		return new Request("https://virtool.test/events", {
			headers: { cookie },
		});
	}

	it("rejects a request that sent no cookies at all", async () => {
		expect(
			await verifyRequest(db, new Request("https://virtool.test/events")),
		).toBeNull();
	});

	it("resolves the session from the cookie header", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		const session = await verifyRequest(
			db,
			request(sessionCookie({ sessionId, token })),
		);

		expect(session).toEqual({ userId });
	});

	it("rejects the cookie header of a deactivated user", async () => {
		const userId = await seedUser(db, { active: false });
		const { sessionId, token } = await seedSession(db, userId);

		const session = await verifyRequest(
			db,
			request(sessionCookie({ sessionId, token })),
		);

		expect(session).toBeNull();
	});
});
