import { emptyPermissions } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
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
	setUser,
}));

// The middleware reads the `db` singleton at module scope. A getter defers the
// read until a handler actually runs, by which point beforeAll has pointed it
// at this file's isolated database.
let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { authenticationExceptions } = await import("./exceptions");
const {
	createAuthenticationMiddleware,
	ForbiddenError,
	requireAdminRole,
	requireAuthenticatedRequest,
	requireSession,
	serverFnIdFromUrl,
	UnauthorizedError,
} = await import("./middleware");
const { createFirstUserFn, loginFn, logoutFn, resetPasswordFn } = await import(
	"./functions"
);
const { getPasswordPolicyFn } = await import("../settings/functions");
const { getRootFn } = await import("../root/functions");
const { seedApiKey, seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { basicAuthHeader, sessionCookie } = await import("./test/fixtures");

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
});

/** The middleware's server handler, which `createMiddleware` stores verbatim. */
type ServerHandler = (options: {
	next: (options?: unknown) => Promise<unknown>;
	serverFnMeta: { id: string };
}) => Promise<unknown>;

function serverHandler(exceptions: ReadonlyArray<{ url: string }>) {
	const middleware = createAuthenticationMiddleware(async () => exceptions);
	return (middleware as unknown as { options: { server: ServerHandler } })
		.options.server;
}

// The metadata Start hands a function middleware. It is not on the public type
// of a server-function reference, which is why the middleware derives the id
// from `url` instead — and why the test below pins the two against each other.
function metaFor(fn: { url: string }): { id: string } {
	return (fn as unknown as { serverFnMeta: { id: string } }).serverFnMeta;
}

function cookieHeader(sessionId: string, token: string): string {
	return sessionCookie({ sessionId, token });
}

function requestFor(url: string, cookie?: string) {
	return new Request(new URL(url, "https://virtool.test"), {
		headers: cookie ? { cookie } : undefined,
	});
}

function authorizedRequestFor(url: string, authorization: string) {
	return new Request(new URL(url, "https://virtool.test"), {
		headers: { authorization },
	});
}

describe("authenticationExceptions", () => {
	// The list is the whole security boundary: anything on it is publicly
	// callable. A fn added here by mistake is a silent hole, so pin the contents
	// rather than just the middleware's handling of them.
	it("exempts exactly the six unauthenticated endpoints", () => {
		expect(authenticationExceptions).toHaveLength(6);
		expect(authenticationExceptions.map((fn) => fn.url).sort()).toEqual(
			[
				createFirstUserFn,
				getPasswordPolicyFn,
				getRootFn,
				loginFn,
				logoutFn,
				resetPasswordFn,
			]
				.map((fn) => fn.url)
				.sort(),
		);
	});
});

// The middleware builds its exception set from each fn's `url`, but matches
// against the `serverFnMeta.id` Start hands it. Nothing in the type system ties
// those together, so pin it: if Start changes either, the exceptions silently
// stop matching and every public endpoint starts refusing anonymous callers.
describe("serverFnIdFromUrl", () => {
	it.each(
		authenticationExceptions.map((fn) => [metaFor(fn).id, fn.url] as const),
	)("recovers %s from its url", (id, url) => {
		expect(serverFnIdFromUrl(url)).toBe(id);
	});
});

describe("createAuthenticationMiddleware", () => {
	it.each([
		["createFirstUserFn", () => createFirstUserFn],
		["getPasswordPolicyFn", () => getPasswordPolicyFn],
		["getRootFn", () => getRootFn],
		["loginFn", () => loginFn],
		["logoutFn", () => logoutFn],
		["resetPasswordFn", () => resetPasswordFn],
	])("lets an unauthenticated call reach %s", async (_label, get) => {
		getRequest.mockReturnValue(requestFor(get().url));
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler(authenticationExceptions)({
			next,
			serverFnMeta: metaFor(get()),
		});

		expect(next).toHaveBeenCalledWith({ context: { session: null } });
		expect(setUser).not.toHaveBeenCalled();
	});

	// A server function invoked during SSR runs in-process, so the incoming
	// request is the page being rendered, not the function's own URL. Identifying
	// the call by that URL exempted nothing at all on the SSR path, and a
	// logged-out hard load rendered a 401 in place of the login wall (VIR-2941).
	it("exempts a call made while rendering a page", async () => {
		getRequest.mockReturnValue(requestFor("/"));
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler(authenticationExceptions)({
			next,
			serverFnMeta: metaFor(getRootFn),
		});

		expect(next).toHaveBeenCalledWith({ context: { session: null } });
	});

	it("rejects an unauthenticated call to a fn that is not excepted", async () => {
		getRequest.mockReturnValue(requestFor("/_serverFn/somethingElse"));
		const next = vi.fn();

		await expect(
			serverHandler(authenticationExceptions)({
				next,
				serverFnMeta: { id: "somethingElse" },
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);

		expect(setResponseStatus).toHaveBeenCalledWith(401);
		expect(next).not.toHaveBeenCalled();
	});

	it("attaches the resolved session to the handler context", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		getRequest.mockReturnValue(
			requestFor("/_serverFn/somethingElse", cookieHeader(sessionId, token)),
		);
		const next = vi.fn().mockResolvedValue("result");

		await serverHandler(authenticationExceptions)({
			next,
			serverFnMeta: { id: "somethingElse" },
		});

		expect(next).toHaveBeenCalledWith({ context: { session: { userId } } });
	});

	it("ties the acting user to the sentry scope", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		getRequest.mockReturnValue(
			requestFor("/_serverFn/somethingElse", cookieHeader(sessionId, token)),
		);

		await serverHandler(authenticationExceptions)({
			next: vi.fn().mockResolvedValue("result"),
			serverFnMeta: { id: "somethingElse" },
		});

		expect(setUser).toHaveBeenCalledWith({ id: userId });
	});

	it("rejects a session whose user has been deactivated", async () => {
		const userId = await seedUser(db, { active: false });
		const { sessionId, token } = await seedSession(db, userId);

		getRequest.mockReturnValue(
			requestFor("/_serverFn/somethingElse", cookieHeader(sessionId, token)),
		);

		await expect(
			serverHandler(authenticationExceptions)({
				next: vi.fn(),
				serverFnMeta: { id: "somethingElse" },
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("authenticates every call when there are no exceptions", async () => {
		getRequest.mockReturnValue(requestFor(loginFn.url));

		await expect(
			serverHandler([])({
				next: vi.fn(),
				serverFnMeta: metaFor(loginFn),
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	// The id is matched exactly, so an id that merely extends an exempt one — the
	// shape a compiler-generated id takes when two exports share a prefix — must
	// not inherit its exemption.
	it("does not treat an id that merely extends an exception as excepted", async () => {
		getRequest.mockReturnValue(requestFor(loginFn.url));

		await expect(
			serverHandler(authenticationExceptions)({
				next: vi.fn(),
				serverFnMeta: { id: `${metaFor(loginFn).id}Extra` },
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});
});

describe("requireSession", () => {
	it("resolves the session carried by the request cookies", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		getRequest.mockReturnValue(
			requestFor("/_serverFn/me", cookieHeader(sessionId, token)),
		);

		expect(await requireSession()).toEqual({ userId });
	});

	it("throws and sets a 401 when the request has no cookies", async () => {
		getRequest.mockReturnValue(requestFor("/_serverFn/me"));

		await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenCalledWith(401);
	});
});

describe("requireAuthenticatedRequest", () => {
	it("resolves the session for a raw request", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		expect(
			await requireAuthenticatedRequest(
				requestFor("/events", cookieHeader(sessionId, token)),
			),
		).toEqual({ userId });
	});

	// Raw route handlers run outside the server-function context, so this returns
	// a Response for the caller to return rather than throwing.
	it("returns a 401 response rather than throwing", async () => {
		const result = await requireAuthenticatedRequest(requestFor("/events"));

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});

	it("resolves an api key from the authorization header", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId, { upload_file: true });

		expect(
			await requireAuthenticatedRequest(
				authorizedRequestFor("/uploads", basicAuthHeader("alice", key)),
			),
		).toEqual({
			userId,
			keyPermissions: { ...emptyPermissions(), upload_file: true },
		});
	});

	it("returns a 401 for an api key that does not resolve", async () => {
		await seedUser(db);

		const result = await requireAuthenticatedRequest(
			authorizedRequestFor("/uploads", basicAuthHeader("alice", "wrong")),
		);

		expect((result as Response).status).toBe(401);
	});

	// Otherwise a script sending a broken header would silently fall through to
	// whatever cookies its client happened to have attached.
	it("does not fall back to cookies when the authorization header is malformed", async () => {
		const userId = await seedUser(db);
		const { sessionId, token } = await seedSession(db, userId);

		const request = new Request("https://virtool.test/uploads", {
			headers: {
				authorization: "Bearer nonsense",
				cookie: cookieHeader(sessionId, token),
			},
		});

		expect(
			((await requireAuthenticatedRequest(request)) as Response).status,
		).toBe(401);
	});
});

describe("requireAdminRole", () => {
	it("rejects a user with no administrator role", async () => {
		const userId = await seedUser(db);

		await expect(requireAdminRole({ userId }, "base")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("rejects a session whose user no longer exists", async () => {
		await expect(
			requireAdminRole({ userId: 404 }, "base"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it.each(["full", "settings", "users", "base"] as const)(
		"allows a full administrator to satisfy a %s requirement",
		async (requiredRole) => {
			const userId = await seedUser(db, { administratorRole: "full" });

			await expect(
				requireAdminRole({ userId }, requiredRole),
			).resolves.toBeUndefined();
		},
	);

	// `full` is the strongest role and `base` the weakest, so a role satisfies a
	// requirement it outranks. Easy to invert; pin both directions.
	it("allows a stronger role to satisfy a weaker requirement", async () => {
		const userId = await seedUser(db, { administratorRole: "settings" });

		await expect(
			requireAdminRole({ userId }, "users"),
		).resolves.toBeUndefined();
	});

	it("rejects a weaker role against a stronger requirement", async () => {
		const userId = await seedUser(db, { administratorRole: "base" });

		await expect(
			requireAdminRole({ userId }, "settings"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
