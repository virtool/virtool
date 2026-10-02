import type { Db } from "@virtool/data/db/pg";
import {
	authAccounts,
	authSessions,
	authTwoFactors,
} from "@virtool/data/db/schema/auth";
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
const createRemediationSession = vi.fn();
let currentUserId: number | null = null;
let currentSessionId: number | null = null;

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
	setContext: vi.fn(),
}));

vi.mock("../auth/instance", () => ({
	auth: {
		api: {
			getSession: vi.fn(async () =>
				currentUserId === null || currentSessionId === null
					? null
					: {
							session: { id: currentSessionId },
							user: { id: currentUserId },
						},
			),
			createRemediationSession,
		},
	},
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
const { hashPassword, verifyPassword } = await import(
	"@virtool/data/auth/password"
);
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);

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
	currentUserId = null;
	currentSessionId = null;
	await db.delete(authSessions);
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
	const hashed = await hashPassword(password);
	const userId = await seedUser(db, { password: hashed });
	const now = new Date();
	await db
		.update(users)
		.set({ authMigratedAt: now })
		.where(eq(users.id, userId));
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: hashed.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});
	const session = await seedSession(db, userId);
	currentUserId = userId;
	currentSessionId = session.sessionId;

	return { session, userId };
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

async function readUser(userId: number) {
	const [row] = await db.select().from(users).where(eq(users.id, userId));
	return row;
}

describe("changePassword", () => {
	it("hands the browser the session that replaces the revoked one", async () => {
		const { userId } = await signIn();

		await call("changePasswordFn", {
			oldPassword: "old_password_123",
			password: "new_password_123",
		});

		const rows = await db
			.select()
			.from(authSessions)
			.where(eq(authSessions.userId, userId));

		expect(rows).toHaveLength(0);
		expect(createRemediationSession).toHaveBeenCalledWith(
			expect.objectContaining({ body: { userId } }),
		);
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

describe("resetUserTotpFn", () => {
	async function signInAdministrator(role: "full" | "users" = "full") {
		const { session, userId } = await signIn();
		await db
			.update(users)
			.set({ administratorRole: role })
			.where(eq(users.id, userId));
		return { session, userId };
	}

	async function seedEnrolledUser() {
		const userId = await seedUser(db, { handle: "bob" });
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "secret",
			userId,
		});
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await seedSession(db, userId);
		return userId;
	}

	it("removes the target's factor and sessions and keeps the caller's", async () => {
		const { session } = await signInAdministrator();
		const targetId = await seedEnrolledUser();

		const user = await call("resetUserTotpFn", { userId: targetId });

		expect(user).toMatchObject({ id: targetId, twoFactorEnabled: false });
		expect(
			await db
				.select()
				.from(authTwoFactors)
				.where(eq(authTwoFactors.userId, targetId)),
		).toHaveLength(0);
		const remaining = await db.select().from(authSessions);
		expect(remaining.map((row) => row.id)).toEqual([session.sessionId]);
		expect(emit).toHaveBeenCalledWith("users", targetId, "update");
	});

	it("refuses the caller's own account", async () => {
		const { userId } = await signInAdministrator();

		await expect(call("resetUserTotpFn", { userId })).rejects.toThrow(
			"Cannot reset own two-factor authentication",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("refuses an administrator without the full role", async () => {
		await signInAdministrator("users");
		const targetId = await seedEnrolledUser();

		await expect(call("resetUserTotpFn", { userId: targetId })).rejects.toThrow(
			"Forbidden",
		);
		expect(
			await db
				.select()
				.from(authTwoFactors)
				.where(eq(authTwoFactors.userId, targetId)),
		).toHaveLength(1);
	});

	it("responds with 404 for an unknown user", async () => {
		await signInAdministrator();

		await expect(call("resetUserTotpFn", { userId: 999_999 })).rejects.toThrow(
			"User not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("responds with 409 for a user with no factor", async () => {
		await signInAdministrator();
		const targetId = await seedUser(db, { handle: "bob" });

		await expect(call("resetUserTotpFn", { userId: targetId })).rejects.toThrow(
			"User has no two-factor authentication.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});
