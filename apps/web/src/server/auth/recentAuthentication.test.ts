import type { Db } from "@virtool/data/db/pg";
import { authAccounts, authTwoFactors } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { APIError } from "better-auth/api";
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
const verifyPassword = vi.fn();
const verifyTOTP = vi.fn();
const createStepUpSession = vi.fn();
const setContext = vi.fn();
let currentUserId: number | null = null;
let currentSessionId: number | null = null;

vi.mock("@tanstack/react-start/server", () => ({
	getRequest,
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	setContext,
	setUser: vi.fn(),
}));

vi.mock("./instance", () => ({
	auth: {
		api: {
			createStepUpSession,
			getSession: vi.fn(async () =>
				currentUserId === null || currentSessionId === null
					? null
					: {
							session: { id: currentSessionId },
							user: { id: currentUserId },
						},
			),
			verifyPassword,
			verifyTOTP,
		},
	},
}));

let db: Db;
vi.mock("../composition", () => ({
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./recentAuthentication.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { UnauthorizedError } = await import("./middleware");
const { hashPassword } = await import("@virtool/data/auth/password");
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
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: { cookie: "better-auth.session_token=secret" },
		}),
	);
	verifyPassword.mockResolvedValue({ status: true });
	verifyTOTP.mockResolvedValue({ token: "never-returned", user: {} });
	createStepUpSession.mockResolvedValue({
		createdAt: new Date(),
		sessionId: 99,
	});
});

async function signIn({ totp = false } = {}) {
	const password = await hashPassword("correct-password");
	const userId = await seedUser(db, { password });
	const now = new Date();
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: password.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});
	if (totp) {
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "encrypted",
			userId,
			verified: true,
		});
	}
	const session = await seedSession(db, userId);
	currentUserId = userId;
	currentSessionId = session.sessionId;
	return { session, userId };
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("getRecentAuthenticationMethodsFn", () => {
	it("reports enrolled methods without returning credential data", async () => {
		await signIn({ totp: true });

		await expect(call("getRecentAuthenticationMethodsFn")).resolves.toEqual({
			password: true,
			totp: true,
		});
	});
});

describe("challengeRecentAuthenticationFn", () => {
	it("uses Better Auth password verification and returns non-secret replacement metadata", async () => {
		await signIn();

		const result = await call("challengeRecentAuthenticationFn", {
			method: "password",
			password: "correct-password",
		});

		expect(verifyPassword).toHaveBeenCalledWith({
			headers: expect.any(Headers),
			body: { password: "correct-password" },
		});
		expect(createStepUpSession).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
		expect(result).toEqual({ createdAt: expect.any(Date), sessionId: 99 });
		expect(JSON.stringify(result)).not.toContain("never-returned");
		expect(setContext).toHaveBeenCalledWith("credential", {
			id: 99,
			kind: "browser",
		});
	});

	it("uses native TOTP verification without trusting the device", async () => {
		await signIn({ totp: true });

		await call("challengeRecentAuthenticationFn", {
			method: "totp",
			code: "012345",
		});

		expect(verifyTOTP).toHaveBeenCalledWith({
			headers: expect.any(Headers),
			body: { code: "012345", trustDevice: false },
		});
	});

	it.each([
		new APIError("UNAUTHORIZED", {
			code: "INVALID_CODE",
			message: "invalid code",
		}),
		new APIError("BAD_REQUEST", {
			code: "TOTP_NOT_ENABLED",
			message: "not enrolled",
		}),
	])("returns one generic response for an invalid challenge", async (error) => {
		await signIn({ totp: true });
		verifyTOTP.mockRejectedValue(error);

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "totp",
				code: "012345",
			}),
		).rejects.toThrow("Authentication challenge failed.");
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("preserves Better Auth's lockout status without exposing details", async () => {
		await signIn({ totp: true });
		verifyTOTP.mockRejectedValue(
			new APIError("TOO_MANY_REQUESTS", {
				code: "ACCOUNT_TEMPORARILY_LOCKED",
				message: "locked",
			}),
		);

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "totp",
				code: "012345",
			}),
		).rejects.toThrow("Authentication challenge failed.");
		expect(setResponseStatus).toHaveBeenCalledWith(429);
	});

	it("does not disguise an operational provider failure", async () => {
		await signIn();
		verifyPassword.mockRejectedValue(new Error("provider unavailable"));

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "password",
				password: "correct-password",
			}),
		).rejects.toThrow("provider unavailable");
		expect(createStepUpSession).not.toHaveBeenCalled();
	});

	it("preserves unauthorized when the session ends during verification", async () => {
		await signIn();
		verifyPassword.mockRejectedValue(
			new APIError("UNAUTHORIZED", {
				code: "UNAUTHORIZED",
				message: "Unauthorized",
			}),
		);

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "password",
				password: "correct-password",
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenCalledWith(401);
		expect(createStepUpSession).not.toHaveBeenCalled();
	});

	it("returns ordinary unauthorized when the session ends during verification", async () => {
		await signIn();
		createStepUpSession.mockRejectedValue(
			new APIError("UNAUTHORIZED", {
				code: "UNAUTHORIZED",
				message: "Unauthorized",
			}),
		);

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "password",
				password: "correct-password",
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenCalledWith(401);
	});

	it("returns an expired challenge when a concurrent replacement wins", async () => {
		await signIn();
		createStepUpSession.mockRejectedValue(
			new APIError("UNAUTHORIZED", {
				code: "STEP_UP_SESSION_ENDED",
				message: "Session ended during authentication",
			}),
		);

		await expect(
			call("challengeRecentAuthenticationFn", {
				method: "password",
				password: "correct-password",
			}),
		).rejects.toThrow("Authentication challenge expired.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});
