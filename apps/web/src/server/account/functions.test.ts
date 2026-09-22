import { seedSession, seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { authSessions } from "@virtool/data/db/schema/auth";
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

const getRequest = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
	setContext: vi.fn(),
}));

// The handlers read the `db` singleton at module scope. A getter defers the
// read until a handler actually runs, by which point beforeAll has pointed it
// at this file's isolated database.
let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { UnauthorizedError } = await import("../auth/middleware");
const { SESSION_FRESH_AGE_SECONDS } = await import("../auth/freshness");
const { SessionNotFreshError } = await import("../auth/policy");
const { signIn } = await import("../auth/test/fixtures");

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(apiKeys);
	await db.delete(authSessions);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

/** Authenticate the next call as a freshly seeded user and return its id. */

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("findApiKeys", () => {
	it("refuses an unauthenticated caller", async () => {
		await expect(call("findApiKeysFn")).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
	});

	it("returns only the signed-in user's keys", async () => {
		await signIn(db, getRequest);
		await call("createApiKeyFn", { name: "Robot", permissions: {} });

		const keys = (await call("findApiKeysFn")) as { name: string }[];

		expect(keys).toHaveLength(1);
		expect(keys[0]?.name).toBe("Robot");
	});
});

describe("active browser sessions", () => {
	it("returns only safe summaries for the signed-in user", async () => {
		const userId = await signIn(db, getRequest);
		await seedSession(db, userId, {
			browser: "Firefox 142.0",
			operatingSystem: "Linux",
		});
		const otherUserId = await seedUser(db, { handle: "bob" });
		await seedSession(db, otherUserId);

		const result = (await call("findActiveBrowserSessionsFn")) as Array<
			Record<string, unknown>
		>;

		expect(result).toHaveLength(2);
		expect(result.filter(({ isCurrent }) => isCurrent)).toHaveLength(1);
		expect(result[0]?.isCurrent).toBe(true);
		expect(result[1]).toMatchObject({
			browser: "Firefox 142.0",
			operatingSystem: "Linux",
			isCurrent: false,
		});
		for (const session of result) {
			expect(session).not.toHaveProperty("token");
			expect(session).not.toHaveProperty("userAgent");
			expect(session).not.toHaveProperty("replacementForSessionId");
		}
	});

	it("revokes an owned non-current session idempotently", async () => {
		const userId = await signIn(db, getRequest);
		const target = await seedSession(db, userId);

		expect(
			await call("revokeBrowserSessionFn", {
				managementId: target.sessionId,
			}),
		).toBeNull();
		expect(
			await call("revokeBrowserSessionFn", {
				managementId: target.sessionId,
			}),
		).toBeNull();
	});

	it("requires a fresh current session", async () => {
		const userId = await signIn(db, getRequest);
		const target = await seedSession(db, userId);
		await db
			.update(authSessions)
			.set({
				createdAt: new Date(
					Date.now() - (SESSION_FRESH_AGE_SECONDS * 1000 + 1),
				),
			})
			.where(eq(authSessions.userId, userId));

		await expect(
			call("revokeBrowserSessionFn", { managementId: target.sessionId }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
		expect(
			await db
				.select({ id: authSessions.id })
				.from(authSessions)
				.where(eq(authSessions.id, target.sessionId)),
		).toEqual([{ id: target.sessionId }]);
	});

	it("does not disclose or revoke another user's session", async () => {
		await signIn(db, getRequest);
		const otherUserId = await seedUser(db, { handle: "bob" });
		const target = await seedSession(db, otherUserId);

		expect(
			await call("revokeBrowserSessionFn", {
				managementId: target.sessionId,
			}),
		).toBeNull();
		expect(
			await db
				.select({ id: authSessions.id })
				.from(authSessions)
				.where(eq(authSessions.id, target.sessionId)),
		).toEqual([{ id: target.sessionId }]);
	});

	it("requires logout to revoke the current session", async () => {
		const userId = await signIn(db, getRequest);
		const [current] = await db
			.select({ id: authSessions.id })
			.from(authSessions)
			.where(eq(authSessions.userId, userId));

		await expect(
			call("revokeBrowserSessionFn", { managementId: current?.id }),
		).rejects.toThrow("Sign out to end the current browser session.");
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("revokes all other sessions and preserves the current one", async () => {
		const userId = await signIn(db, getRequest);
		await seedSession(db, userId);
		await seedSession(db, userId);
		const [current] = await db
			.select({ id: authSessions.id })
			.from(authSessions)
			.where(eq(authSessions.userId, userId))
			.orderBy(authSessions.id)
			.limit(1);

		expect(await call("revokeOtherBrowserSessionsFn")).toEqual({ revoked: 2 });
		expect(await db.select({ id: authSessions.id }).from(authSessions)).toEqual(
			[{ id: current?.id }],
		);
	});
});

describe("createApiKey", () => {
	it("returns the raw secret and a 201", async () => {
		await signIn(db, getRequest);

		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: { create_ref: true },
		})) as { key: string; name: string };

		expect(created.key).toMatch(/^[0-9a-f]{64}$/);
		expect(created.name).toBe("Robot");
		expect(setResponseStatus).toHaveBeenCalledWith(201);
	});

	it("does not let rolling expiry renew freshness", async () => {
		const userId = await signIn(db, getRequest);
		await db
			.update(authSessions)
			.set({
				createdAt: new Date(
					Date.now() - (SESSION_FRESH_AGE_SECONDS * 1000 + 1),
				),
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
				updatedAt: new Date(),
			})
			.where(eq(authSessions.userId, userId));

		await expect(
			call("createApiKeyFn", { name: "Robot", permissions: {} }),
		).rejects.toBeInstanceOf(SessionNotFreshError);
		expect(await db.select().from(apiKeys)).toHaveLength(0);
	});
});

describe("updateApiKey", () => {
	it("responds with 404 for a key the user does not own", async () => {
		const owner = await signIn(db, getRequest, { handle: "owner" });
		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: {},
		})) as { id: number };

		await signIn(db, getRequest, { handle: "intruder" });

		await expect(
			call("updateApiKeyFn", {
				keyId: created.id,
				permissions: { create_ref: true },
			}),
		).rejects.toThrow("API key not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
		// The owner's key is untouched.
		const [row] = await db.select().from(apiKeys);
		expect(row?.userId).toBe(owner);
		expect(row?.permissions.create_ref).toBe(false);
	});
});

describe("deleteApiKey", () => {
	it("removes the signed-in user's key", async () => {
		await signIn(db, getRequest);
		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: {},
		})) as { id: number };

		await call("deleteApiKeyFn", { keyId: created.id });

		expect(await db.select().from(apiKeys)).toHaveLength(0);
	});

	it("responds with 404 when the key does not exist", async () => {
		await signIn(db, getRequest);

		await expect(call("deleteApiKeyFn", { keyId: 404 })).rejects.toThrow(
			"API key not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});
