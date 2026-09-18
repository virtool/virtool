import {
	emptyPermissions,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
} from "@virtool/contracts";
import { createAuthenticatedSession } from "@virtool/data/auth/session";
import {
	seedApiKey,
	seedSession,
	seedSetupSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { authSessions } from "@virtool/data/db/schema/auth";
import { setupSessions } from "@virtool/data/db/schema/setup";
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
import type { SetupEndpoint } from "./setupExceptions";

const getRequest = vi.fn();
const setResponseStatus = vi.fn();
const setContext = vi.fn();
const setUser = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setContext,
	setUser,
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { authenticationExceptions, passwordResetEndpoints } = await import(
	"./exceptions"
);
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import("./cookies");
const {
	createAuthenticationMiddleware,
	ForbiddenError,
	requireAdminRole,
	requireAuthenticatedRequest,
	requireBrowserPrincipal,
	UnauthorizedError,
} = await import("./middleware");
const {
	completeEmailRemediationFn,
	createFirstUserFn,
	loginFn,
	logoutFn,
	resetPasswordFn,
	verifyTwoFactorFn,
} = await import("./functions");
const { getPasswordPolicyFn } = await import("../settings/functions");
const { getRootFn } = await import("../root/functions");
const { createSampleFn, findSamplesFn, recordSampleViewFn } = await import(
	"../samples/functions"
);
const { basicAuthHeader, sessionCookie, setupSessionCookie } = await import(
	"./test/fixtures"
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
	await db.delete(apiKeys);
	await db.delete(authSessions);
	await db.delete(setupSessions);
	await db.delete(users);
});

type ServerHandler = (options: {
	next: (options?: unknown) => Promise<unknown>;
	serverFnMeta: { id: string };
}) => Promise<unknown>;

function serverHandler(
	exceptions: ReadonlyArray<{ url: string }> = authenticationExceptions,
	setup: ReadonlyArray<SetupEndpoint> = [],
	passwordReset: ReadonlyArray<{ url: string }> = passwordResetEndpoints,
) {
	const middleware = createAuthenticationMiddleware(
		async () => exceptions,
		async () => setup,
		async () => passwordReset,
	);
	return (middleware as unknown as { options: { server: ServerHandler } })
		.options.server;
}

function metaFor(fn: { url: string }): { id: string } {
	return (fn as unknown as { serverFnMeta: { id: string } }).serverFnMeta;
}

function requestFor(cookie?: string, authorization?: string): Request {
	return new Request("https://virtool.test/_serverFn/test", {
		headers: {
			...(cookie ? { cookie } : {}),
			...(authorization ? { authorization } : {}),
		},
	});
}

function browserPrincipal(userId: number) {
	return {
		kind: "browser" as const,
		sessionId: 1,
		createdAt: new Date(),
		sessionStore: "better_auth" as const,
		userId,
	};
}

describe("authentication exceptions", () => {
	it("exempts exactly the seven open functions", () => {
		expect(authenticationExceptions.map((fn) => fn.url).sort()).toEqual(
			[
				completeEmailRemediationFn,
				createFirstUserFn,
				getPasswordPolicyFn,
				getRootFn,
				loginFn,
				logoutFn,
				verifyTwoFactorFn,
			]
				.map((fn) => fn.url)
				.sort(),
		);
		expect(passwordResetEndpoints).toEqual([resetPasswordFn]);
	});

	it("clears attribution and passes a null principal", async () => {
		getRequest.mockReturnValue(requestFor());
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler()({ next, serverFnMeta: metaFor(loginFn) });

		expect(next).toHaveBeenCalledWith({ context: { principal: null } });
		expect(setUser).toHaveBeenCalledWith(null);
		expect(setContext).toHaveBeenCalledWith("credential", null);
	});
});

describe("browser boundary", () => {
	it.each([createSampleFn, findSamplesFn, recordSampleViewFn])(
		"keeps application reads and mutations read-only ($url)",
		async (fn) => {
			const userId = await seedUser(db);
			const expiresAt = new Date(Date.now() + 30 * 60_000);
			const session = await seedSession(db, userId, {
				expiresAt,
			});
			getRequest.mockReturnValue(requestFor(sessionCookie(session)));

			await serverHandler()({
				next: vi.fn().mockResolvedValue("result"),
				serverFnMeta: metaFor(fn),
			});

			const [unchanged] = await db
				.select({ expiresAt: authSessions.expiresAt })
				.from(authSessions)
				.where(eq(authSessions.id, session.sessionId));
			expect(unchanged?.expiresAt).toEqual(expiresAt);
		},
	);

	it("resolves a retained legacy browser principal", async () => {
		const userId = await seedUser(db);
		const session = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		getRequest.mockReturnValue(
			requestFor(
				`${SESSION_ID_COOKIE}=${session.sessionId}; ${SESSION_TOKEN_COOKIE}=${session.token}`,
			),
		);
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler()({ next, serverFnMeta: { id: "ordinary" } });

		expect(next).toHaveBeenCalledWith({
			context: {
				principal: expect.objectContaining({
					kind: "browser",
					sessionId: session.row.id,
					sessionStore: "legacy",
					userId,
				}),
			},
		});
	});

	it("resolves one Better Auth browser principal", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId);
		getRequest.mockReturnValue(requestFor(sessionCookie(session)));
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler()({
			next,
			serverFnMeta: { id: "ordinary" },
		});

		expect(next).toHaveBeenCalledWith({
			context: {
				principal: expect.objectContaining({
					kind: "browser",
					sessionId: session.sessionId,
					sessionStore: "better_auth",
					userId,
				}),
			},
		});
		expect(setUser).toHaveBeenCalledWith({ id: userId });
		expect(setContext).toHaveBeenCalledWith("credential", {
			kind: "browser",
			id: session.sessionId,
		});
	});

	it("prefers Better Auth when both session families are present", async () => {
		const userId = await seedUser(db);
		const betterAuth = await seedSession(db, userId);
		const legacy = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		getRequest.mockReturnValue(
			requestFor(
				`${sessionCookie(betterAuth)}; ${SESSION_ID_COOKIE}=${legacy.sessionId}; ${SESSION_TOKEN_COOKIE}=${legacy.token}`,
			),
		);
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler()({ next, serverFnMeta: { id: "ordinary" } });

		expect(next).toHaveBeenCalledWith({
			context: {
				principal: expect.objectContaining({
					kind: "browser",
					sessionId: betterAuth.sessionId,
					sessionStore: "better_auth",
					userId,
				}),
			},
		});
	});

	it("rejects an absent or deactivated session with one generic 401", async () => {
		getRequest.mockReturnValue(requestFor());
		await expect(
			serverHandler()({ next: vi.fn(), serverFnMeta: { id: "ordinary" } }),
		).rejects.toBeInstanceOf(UnauthorizedError);

		const userId = await seedUser(db, { active: false });
		const session = await seedSession(db, userId);
		getRequest.mockReturnValue(requestFor(sessionCookie(session)));
		await expect(
			serverHandler()({ next: vi.fn(), serverFnMeta: { id: "ordinary" } }),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenLastCalledWith(401);
	});

	it("restricts force-reset sessions to the reset endpoint", async () => {
		const userId = await seedUser(db, { forceReset: true });
		const session = await seedSession(db, userId);
		getRequest.mockReturnValue(requestFor(sessionCookie(session)));

		const error = await serverHandler()({
			next: vi.fn(),
			serverFnMeta: { id: "ordinary" },
		}).catch((value) => value);
		expect(error).toBeInstanceOf(Error);
		if (!(error instanceof Error)) {
			throw error;
		}
		expect(error.name).toBe(PASSWORD_RESET_REQUIRED_ERROR_NAME);

		const next = vi.fn().mockResolvedValue("result");
		await serverHandler()({
			next,
			serverFnMeta: metaFor(resetPasswordFn),
		});
		expect(next).toHaveBeenCalledWith({
			context: {
				principal: expect.objectContaining({
					kind: "password_reset",
					sessionId: session.sessionId,
					sessionStore: "better_auth",
					userId,
				}),
			},
		});
	});
});

describe("setup boundary", () => {
	it("names the setup purpose when refusing an ordinary function", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const setup = await seedSetupSession(db, userId, "account_completion");
		getRequest.mockReturnValue(requestFor(setupSessionCookie(setup)));

		const error = await serverHandler()({
			next: vi.fn(),
			serverFnMeta: { id: "ordinary" },
		}).catch((value) => value);
		expect(error).toBeInstanceOf(Error);
		if (!(error instanceof Error)) {
			throw error;
		}
		expect(error.name).toBe(SETUP_REQUIRED_ERROR_NAME);
		expect((error as Error & { purpose: string }).purpose).toBe(
			"account_completion",
		);
	});
});

describe("raw request boundary", () => {
	it("accepts retained legacy sessions", async () => {
		const userId = await seedUser(db);
		const session = await createAuthenticatedSession(db, {
			userId,
			ip: "127.0.0.1",
		});
		const cookie = `${SESSION_ID_COOKIE}=${session.sessionId}; ${SESSION_TOKEN_COOKIE}=${session.token}`;

		await expect(
			requireAuthenticatedRequest(requestFor(cookie)),
		).resolves.toMatchObject({
			kind: "browser",
			sessionId: session.row.id,
			sessionStore: "legacy",
			userId,
		});
	});

	it("accepts browser sessions and API keys as distinct principals", async () => {
		const userId = await seedUser(db);
		const expiresAt = new Date(Date.now() + 30 * 60_000);
		const session = await seedSession(db, userId, { expiresAt });
		await expect(
			requireAuthenticatedRequest(requestFor(sessionCookie(session))),
		).resolves.toMatchObject({
			kind: "browser",
			sessionId: session.sessionId,
			sessionStore: "better_auth",
			userId,
		});
		const [unchanged] = await db
			.select({ expiresAt: authSessions.expiresAt })
			.from(authSessions)
			.where(eq(authSessions.id, session.sessionId));
		expect(unchanged?.expiresAt).toEqual(expiresAt);

		const key = await seedApiKey(db, userId, { upload_file: true });
		const [row] = await db.select({ id: apiKeys.id }).from(apiKeys);
		await expect(
			requireAuthenticatedRequest(
				requestFor(undefined, basicAuthHeader("alice", key)),
			),
		).resolves.toEqual({
			kind: "api_key",
			keyId: row?.id,
			permissions: { ...emptyPermissions(), upload_file: true },
			userId,
		});
	});

	it("does not fall back to a browser cookie after an invalid header", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId);
		const result = await requireAuthenticatedRequest(
			requestFor(sessionCookie(session), "Bearer invalid"),
		);
		expect((result as Response).status).toBe(401);
	});

	it("rejects forced-reset and setup credentials", async () => {
		const resetUser = await seedUser(db, {
			forceReset: true,
			handle: "reset-user",
		});
		const resetSession = await seedSession(db, resetUser);
		expect(
			(
				(await requireAuthenticatedRequest(
					requestFor(sessionCookie(resetSession)),
				)) as Response
			).status,
		).toBe(401);
	});
});

describe("policy helpers", () => {
	it("requires an ordinary browser principal", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId);
		getRequest.mockReturnValue(requestFor(sessionCookie(session)));
		await expect(requireBrowserPrincipal()).resolves.toMatchObject({
			kind: "browser",
			sessionId: session.sessionId,
			sessionStore: "better_auth",
			userId,
		});
	});

	it("checks administrator roles against the principal user", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });
		await expect(
			requireAdminRole(browserPrincipal(userId), "settings"),
		).resolves.toBeUndefined();
		await expect(
			requireAdminRole(browserPrincipal(userId), "full"),
		).resolves.toBeUndefined();
	});

	it("rejects a non-administrator", async () => {
		const userId = await seedUser(db);
		await expect(
			requireAdminRole(browserPrincipal(userId), "base"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
