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
		path: "../messages/functions.ts",
		fns: await import("../messages/functions"),
		handlers: (await import(
			"../messages/functions.ts?tss-serverfn-split"
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

/** Every exported server function, paired with whether it is declared open. */
const endpoints = MODULES.flatMap(({ fns, handlers, path }) =>
	Object.entries(fns as Record<string, unknown>).flatMap((entry) => {
		const [name, value] = entry;
		const url = (value as { url?: unknown }).url;

		// A server function is the only export carrying a `url`; the schemas and
		// types alongside it are not endpoints.
		if (typeof value !== "function" || typeof url !== "string") {
			return [];
		}

		return [{ handlers, isOpen: openUrls.has(url), name, path }];
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

// This is the check that makes declaring a policy non-optional. A server
// function built without one has no session guard of its own, so an anonymous
// call reaches its handler instead of being refused — and it fails here.
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
