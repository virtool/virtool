import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import type { Db } from "../db/pg";
import { apiKeys } from "../db/schema/apiKeys";
import { sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
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
}));

// The handlers read the `db` singleton at module scope. A getter defers the
// read until a handler actually runs, by which point beforeAll has pointed it
// at this file's isolated database.
let db: Db;
vi.mock("../db/pg", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { UnauthorizedError } = await import("../auth/middleware");
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import(
	"../auth/cookies"
);
const { seedSession, seedUser } = await import("../auth/test/fixtures");

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
	await db.delete(sessions);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

/** Authenticate the next call as a freshly seeded user and return its id. */
async function signIn(handle = "alice"): Promise<number> {
	const userId = await seedUser(db, { handle });
	const { sessionId, token } = await seedSession(db, userId);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${sessionId}; ${SESSION_TOKEN_COOKIE}=${token}`,
			},
		}),
	);

	return userId;
}

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
		await signIn();
		await call("createApiKeyFn", { name: "Robot", permissions: {} });

		const keys = (await call("findApiKeysFn")) as { name: string }[];

		expect(keys).toHaveLength(1);
		expect(keys[0]?.name).toBe("Robot");
	});
});

describe("createApiKey", () => {
	it("returns the raw secret and a 201", async () => {
		await signIn();

		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: { create_ref: true },
		})) as { key: string; name: string };

		expect(created.key).toMatch(/^[0-9a-f]{64}$/);
		expect(created.name).toBe("Robot");
		expect(setResponseStatus).toHaveBeenCalledWith(201);
	});
});

describe("updateApiKey", () => {
	it("responds with 404 for a key the user does not own", async () => {
		const owner = await signIn("owner");
		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: {},
		})) as { id: number };

		await signIn("intruder");

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
	it("removes the signed-in user's key with a 204", async () => {
		await signIn();
		const created = (await call("createApiKeyFn", {
			name: "Robot",
			permissions: {},
		})) as { id: number };

		await call("deleteApiKeyFn", { keyId: created.id });

		expect(setResponseStatus).toHaveBeenCalledWith(204);
		expect(await db.select().from(apiKeys)).toHaveLength(0);
	});

	it("responds with 404 when the key does not exist", async () => {
		await signIn();

		await expect(call("deleteApiKeyFn", { keyId: 404 })).rejects.toThrow(
			"API key not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});
