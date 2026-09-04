import {
	SETUP_REQUIRED_ERROR_NAME,
	type SetupPurpose,
} from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { setupSessions } from "@virtool/data/db/schema/setup";
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

const getRequest = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { resolveRestrictedSetup, SetupRequiredError } = await import(
	"./restricted"
);
const { setupOnly } = await import("./policy");
const { UnauthorizedError, ForbiddenError } = await import("./middleware");
const { seedSetupSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { sessionCookie, setupSessionCookie } = await import("./test/fixtures");
const { seedSession } = await import("@virtool/data/auth/test/fixtures");

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
	await db.delete(setupSessions);
	await db.delete(users);
});

function requestWith(cookie?: string): Request {
	return new Request("https://virtool.test/_serverFn/test", {
		headers: cookie ? { cookie } : undefined,
	});
}

/** The policy's server handler, which `createMiddleware` stores verbatim. */
type ServerHandler = (options: {
	context: unknown;
	next: (options?: unknown) => Promise<unknown>;
}) => Promise<unknown>;

function handlerFor(purpose: SetupPurpose) {
	const middleware = setupOnly(purpose);
	return (middleware as unknown as { options: { server: ServerHandler } })
		.options.server;
}

describe("SetupRequiredError", () => {
	it("carries the purpose and the shared name, and nothing else", () => {
		const error = new SetupRequiredError("email_remediation");

		expect(error.name).toBe(SETUP_REQUIRED_ERROR_NAME);
		expect(error.purpose).toBe("email_remediation");
		// Enumerable, so the serialization adapter can read it off across the
		// server-function boundary; nothing else is added.
		expect(Object.keys(error).toSorted()).toEqual(["name", "purpose"]);
	});
});

describe("resolveRestrictedSetup", () => {
	it("resolves the credential the setup cookies carry", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const session = await seedSetupSession(db, userId, "account_completion");

		expect(
			await resolveRestrictedSetup(requestWith(setupSessionCookie(session))),
		).toEqual({
			userId,
			sessionId: session.sessionId,
			purpose: "account_completion",
			expiresAt: expect.any(Date),
		});
	});

	it("returns null with no cookies at all", async () => {
		expect(await resolveRestrictedSetup(requestWith())).toBeNull();
	});

	// The two credentials are separate pairs, so neither can be mistaken for
	// the other however the boundary is later rearranged.
	it("returns null for an application session's cookies", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId);

		expect(
			await resolveRestrictedSetup(requestWith(sessionCookie(session))),
		).toBeNull();
	});
});

describe("setupOnly", () => {
	it("passes a matching restricted credential through", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const session = await seedSetupSession(db, userId, "account_completion");
		const next = vi.fn().mockResolvedValue("result");

		getRequest.mockReturnValue(requestWith(setupSessionCookie(session)));

		await handlerFor("account_completion")({ context: {}, next });

		expect(next).toHaveBeenCalledWith({
			context: {
				restricted: {
					userId,
					sessionId: session.sessionId,
					purpose: "account_completion",
					expiresAt: expect.any(Date),
				},
			},
		});
	});

	// A credential for one transition must not be spendable on another.
	it("refuses a credential for a different purpose", async () => {
		const userId = await seedUser(db);
		const session = await seedSetupSession(db, userId, "email_remediation");
		const next = vi.fn();

		getRequest.mockReturnValue(requestWith(setupSessionCookie(session)));

		await expect(
			handlerFor("totp_enrollment")({ context: {}, next }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(next).not.toHaveBeenCalled();
	});

	it("refuses an anonymous caller with a 401", async () => {
		getRequest.mockReturnValue(requestWith());

		await expect(
			handlerFor("account_completion")({ context: {}, next: vi.fn() }),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenCalledWith(401);
	});

	// A user who has completed setup has no transition outstanding, so a setup
	// surface is not theirs to reach.
	it("refuses an ordinary authenticated caller", async () => {
		const userId = await seedUser(db);
		const session = await seedSession(db, userId);

		getRequest.mockReturnValue(requestWith(sessionCookie(session)));

		await expect(
			handlerFor("account_completion")({ context: {}, next: vi.fn() }),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("reuses the credential the global middleware already resolved", async () => {
		const next = vi.fn().mockResolvedValue("result");
		const restricted = {
			userId: 7,
			sessionId: "setup_upstream",
			purpose: "totp_enrollment" as const,
			expiresAt: new Date(Date.now() + 60_000),
		};

		await handlerFor("totp_enrollment")({ context: { restricted }, next });

		expect(next).toHaveBeenCalledWith({ context: { restricted } });
		expect(getRequest).not.toHaveBeenCalled();
	});
});
