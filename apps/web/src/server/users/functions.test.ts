import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
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
const setCookie = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie,
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

// `createTestDatabase` imports this module, so the factory runs during the
// import phase — before a plain `const` would be initialised.
const emit = vi.hoisted(() => vi.fn());
vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit,
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
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import(
	"../auth/cookies"
);
const { hashPassword, verifyPassword } = await import(
	"@virtool/data/auth/password"
);
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { hashToken } = await import("@virtool/data/auth/tokens");

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
	await db.delete(sessions);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

/**
 * Authenticate the next call as a freshly seeded user holding `password`, and
 * return its id alongside the session that authenticates it.
 */
async function signIn(password = "old_password_123") {
	const userId = await seedUser(db, { password: await hashPassword(password) });
	const session = await seedSession(db, userId);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${session.sessionId}; ${SESSION_TOKEN_COOKIE}=${session.token}`,
			},
		}),
	);

	return { session, userId };
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

async function readUser(userId: number) {
	const [row] = await db.select().from(users).where(eq(users.id, userId));
	return row;
}

describe("updateAccountEmail", () => {
	it("sets the signed-in user's address", async () => {
		const { userId } = await signIn();

		const account = (await call("updateAccountEmailFn", {
			email: "alice@example.com",
		})) as { email: string };

		expect(account.email).toBe("alice@example.com");
		expect((await readUser(userId))?.email).toBe("alice@example.com");
	});

	it("accepts an empty string as clearing the address", async () => {
		const { userId } = await signIn();
		await call("updateAccountEmailFn", { email: "alice@example.com" });

		await call("updateAccountEmailFn", { email: "" });

		expect((await readUser(userId))?.email).toBe("");
	});

	it("responds with 400 for a malformed address", async () => {
		const { userId } = await signIn();

		await expect(
			call("updateAccountEmailFn", { email: "not-an-address" }),
		).rejects.toThrow("The format of the email is invalid");
		expect(setResponseStatus).toHaveBeenCalledWith(400);
		expect((await readUser(userId))?.email).toBe("");
	});
});

describe("changePassword", () => {
	it("hands the browser the session that replaces the revoked one", async () => {
		const { session, userId } = await signIn();

		await call("changePasswordFn", {
			oldPassword: "old_password_123",
			password: "new_password_123",
		});

		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId));

		// The request's own session went with the rest, so the cookies must carry
		// the replacement or the user is signed out by their own password change.
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sessionId).not.toBe(session.sessionId);

		const idCookie = setCookie.mock.calls.find(
			(args) => args[0] === SESSION_ID_COOKIE,
		);
		const tokenCookie = setCookie.mock.calls.find(
			(args) => args[0] === SESSION_TOKEN_COOKIE,
		);

		expect(idCookie?.[1]).toBe(rows[0]?.sessionId);
		expect(hashToken(tokenCookie?.[1] as string)).toBe(rows[0]?.tokenHash);
	});

	// lastPasswordChange and forceReset are both on the administration user
	// detail, so an admin with it open needs the invalidation.
	it("publishes a users update so an open administrator view refreshes", async () => {
		const { userId } = await signIn();

		await call("changePasswordFn", {
			oldPassword: "old_password_123",
			password: "new_password_123",
		});

		expect(emit).toHaveBeenCalledWith("users", userId, "update");
	});

	it("responds with 400 for a wrong old password and sets no cookies", async () => {
		const { userId } = await signIn();

		await expect(
			call("changePasswordFn", {
				oldPassword: "wrong_password_123",
				password: "new_password_123",
			}),
		).rejects.toThrow("Invalid credentials");

		expect(setResponseStatus).toHaveBeenCalledWith(400);
		expect(setCookie).not.toHaveBeenCalled();
		expect(
			await verifyPassword(
				"old_password_123",
				(await readUser(userId))?.password as Buffer,
			),
		).toBe(true);
	});

	it("responds with 400 for a password shorter than the configured minimum", async () => {
		const { userId } = await signIn();

		await expect(
			call("changePasswordFn", {
				oldPassword: "old_password_123",
				password: "short",
			}),
		).rejects.toThrow("Password does not meet minimum length requirement (8)");

		expect(setResponseStatus).toHaveBeenCalledWith(400);
		expect(setCookie).not.toHaveBeenCalled();
		expect(
			await verifyPassword(
				"old_password_123",
				(await readUser(userId))?.password as Buffer,
			),
		).toBe(true);
	});
});
