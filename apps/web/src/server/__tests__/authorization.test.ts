/// <reference types="vite/client" />
// The server tsconfig carries Node types, not Vite's, so `import.meta.glob` —
// used below to prove this file covers every functions.ts — needs the reference.

import type { Db } from "@virtool/data/db/pg";
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
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const getRequest = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus: vi.fn(),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

const { UnauthorizedError } = await import("../auth/middleware");
const { authenticationExceptions } = await import("../auth/exceptions");
const { setupEndpoints } = await import("../auth/setupExceptions");
const { seedSetupSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { setupSessionCookie } = await import("../auth/test/fixtures");

/**
 * Every module that defines server functions, paired with the split module
 * carrying its real handler bodies. A `functions.ts` missing from this list
 * fails the coverage test below.
 */
const MODULES = [
	{
		path: "../analyses/functions.ts",
		fns: await import("../analyses/functions"),
		handlers: (await import(
			"../analyses/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../account/functions.ts",
		fns: await import("../account/functions"),
		handlers: (await import(
			"../account/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../auth/functions.ts",
		fns: await import("../auth/functions"),
		handlers: (await import(
			"../auth/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../groups/functions.ts",
		fns: await import("../groups/functions"),
		handlers: (await import(
			"../groups/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../genbank/functions.ts",
		fns: await import("../genbank/functions"),
		handlers: (await import(
			"../genbank/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../hmm/functions.ts",
		fns: await import("../hmm/functions"),
		handlers: (await import(
			"../hmm/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../indexes/functions.ts",
		fns: await import("../indexes/functions"),
		handlers: (await import(
			"../indexes/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../jobs/functions.ts",
		fns: await import("../jobs/functions"),
		handlers: (await import(
			"../jobs/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../labels/functions.ts",
		fns: await import("../labels/functions"),
		handlers: (await import(
			"../labels/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../banners/functions.ts",
		fns: await import("../banners/functions"),
		handlers: (await import(
			"../banners/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../email/functions.ts",
		fns: await import("../email/functions"),
		handlers: (await import(
			"../email/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../otus/functions.ts",
		fns: await import("../otus/functions"),
		handlers: (await import(
			"../otus/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../references/functions.ts",
		fns: await import("../references/functions"),
		handlers: (await import(
			"../references/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../root/functions.ts",
		fns: await import("../root/functions"),
		handlers: (await import(
			"../root/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../samples/functions.ts",
		fns: await import("../samples/functions"),
		handlers: (await import(
			"../samples/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../settings/functions.ts",
		fns: await import("../settings/functions"),
		handlers: (await import(
			"../settings/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../subtraction/functions.ts",
		fns: await import("../subtraction/functions"),
		handlers: (await import(
			"../subtraction/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../tasks/functions.ts",
		fns: await import("../tasks/functions"),
		handlers: (await import(
			"../tasks/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../uploads/functions.ts",
		fns: await import("../uploads/functions"),
		handlers: (await import(
			"../uploads/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
	{
		path: "../users/functions.ts",
		fns: await import("../users/functions"),
		handlers: (await import(
			"../users/functions.ts?tss-serverfn-split"
		)) as SplitServerFnModule,
	},
];

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(() => {
	vi.clearAllMocks();
	// No cookies: an anonymous caller.
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

const openUrls = new Set(authenticationExceptions.map((fn) => fn.url));
const setupUrls = new Set(setupEndpoints.map(({ fn }) => fn.url));

/**
 * Every exported server function, paired with which of the three reaches it:
 * anyone, an application session, or a restricted setup principal.
 */
const endpoints = MODULES.flatMap(({ fns, handlers, path }) =>
	Object.entries(fns as Record<string, unknown>).flatMap((entry) => {
		const [name, value] = entry;
		const url = (value as { url?: unknown }).url;

		// A server function is the only export carrying a `url`; the schemas and
		// types alongside it are not endpoints.
		if (typeof value !== "function" || typeof url !== "string") {
			return [];
		}

		return [
			{
				handlers,
				isOpen: openUrls.has(url),
				isSetup: setupUrls.has(url),
				name,
				path,
			},
		];
	}),
);

describe("server function coverage", () => {
	// The list above is what makes the check exhaustive. A new feature's
	// functions.ts that nobody adds here would otherwise go unchecked — and an
	// unauthorized endpoint looks exactly like an authorized one.
	it("checks every functions.ts in src/server", () => {
		const onDisk = Object.keys(
			import.meta.glob("../**/functions.ts", { eager: false }),
		).sort();

		expect(MODULES.map((module) => module.path).sort()).toEqual(onDisk);
	});

	it("finds every server function", () => {
		expect(endpoints.length).toBeGreaterThan(20);
	});
});

// This is the check that makes declaring a policy non-optional. Nothing in the
// type system forces one: a server function built without a policy has no
// session guard of its own, so an anonymous call reaches its handler instead of
// being refused — and it fails here, by name.
//
// It also pins `authenticationExceptions` from the other side: a function
// declared `open()` but left out of that list is authenticated by the global
// middleware and cannot serve its purpose, and a function in the list that is
// *not* open is publicly callable.
describe("every server function refuses an anonymous caller", () => {
	const guarded = endpoints.filter((endpoint) => !endpoint.isOpen);

	it.each(guarded.map((endpoint) => [endpoint.name, endpoint] as const))(
		"%s rejects a call with no session",
		async (_name, endpoint) => {
			await expect(
				callServerFn(endpoint.handlers, endpoint.name, undefined),
			).rejects.toBeInstanceOf(UnauthorizedError);
		},
	);
});

describe("the open endpoints are reachable without a session", () => {
	const open = endpoints.filter((endpoint) => endpoint.isOpen);

	it("lists exactly the declared exceptions", () => {
		expect(open.map((endpoint) => endpoint.name).sort()).toEqual([
			"createFirstUserFn",
			"getPasswordPolicyFn",
			"getRootFn",
			"loginFn",
			"logoutFn",
			"resetPasswordFn",
		]);
	});

	// They may fail on validation or on missing data — they must not fail on
	// authentication, which is the whole reason they are exempt.
	it.each(open.map((endpoint) => [endpoint.name, endpoint] as const))(
		"%s is not refused for want of a session",
		async (_name, endpoint) => {
			const error = await callServerFn(
				endpoint.handlers,
				endpoint.name,
				undefined,
			).then(
				() => null,
				(err: unknown) => err,
			);

			expect(error).not.toBeInstanceOf(UnauthorizedError);
		},
	);
});

/**
 * Point the request at a restricted setup credential and nothing else.
 *
 * A restricted caller holds neither half of the session cookie pair, which is
 * why every policy below refuses them without knowing the concept exists.
 */
let restrictedUsers = 0;

async function restrictNextCall(): Promise<void> {
	// A distinct handle per call: `users.handle` is unique case-insensitively
	// and this runs once per endpoint.
	restrictedUsers += 1;
	const userId = await seedUser(db, {
		handle: `pending${restrictedUsers}`,
		lifecycleState: "pending",
	});
	const session = await seedSetupSession(db, userId, "account_completion");

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: { cookie: setupSessionCookie(session) },
		}),
	);
}

// The other half of the setup boundary. The global middleware refuses a
// restricted caller anything outside `setupEndpoints` before a policy runs;
// this proves each policy refuses them on its own too, so the two are not one
// mistake away from an in-progress setup becoming an ordinary session.
describe("every server function refuses a restricted setup principal", () => {
	const guarded = endpoints.filter(
		(endpoint) => !endpoint.isOpen && !endpoint.isSetup,
	);

	it.each(guarded.map((endpoint) => [endpoint.name, endpoint] as const))(
		"%s rejects a restricted caller",
		async (_name, endpoint) => {
			await restrictNextCall();

			await expect(
				callServerFn(endpoint.handlers, endpoint.name, undefined),
			).rejects.toBeInstanceOf(UnauthorizedError);
		},
	);
});

describe("the setup endpoints are the only ones a restricted caller reaches", () => {
	const setup = endpoints.filter((endpoint) => endpoint.isSetup);

	// A url in `setupEndpoints` that matches no exported server function is a
	// stale entry widening the allowlist for nothing.
	//
	// The other direction needs no assertion of its own: a function declaring
	// `setupOnly()` but left out of the list would not refuse the restricted
	// caller above, and fails there by name.
	it("resolves every declared entry to an exported server function", () => {
		expect(setup).toHaveLength(setupEndpoints.length);
	});

	// They may fail on validation or on missing data — they must not fail for
	// want of a credential they were never going to be given.
	it.each(setup.map((endpoint) => [endpoint.name, endpoint] as const))(
		"%s is not refused for want of an application session",
		async (_name, endpoint) => {
			await restrictNextCall();

			const error = await callServerFn(
				endpoint.handlers,
				endpoint.name,
				undefined,
			).then(
				() => null,
				(err: unknown) => err,
			);

			expect(error).not.toBeInstanceOf(UnauthorizedError);
		},
	);
});
