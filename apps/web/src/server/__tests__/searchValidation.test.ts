import { seedUser } from "@virtool/data/auth/test/fixtures";
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
import { authenticateAs } from "../auth/test/fixtures";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const { getRequest } = vi.hoisted(() => ({ getRequest: vi.fn() }));
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

const modules: Record<string, SplitServerFnModule> = {
	findSamplesFn: await import("../samples/functions.ts?tss-serverfn-split"),
	findAnalysesFn: await import("../analyses/functions.ts?tss-serverfn-split"),
	getJobsFn: await import("../jobs/functions.ts?tss-serverfn-split"),
	getTasksFn: await import("../tasks/functions.ts?tss-serverfn-split"),
	findUsersFn: await import("../users/functions.ts?tss-serverfn-split"),
	searchUsersFn: await import("../users/functions.ts?tss-serverfn-split"),
	findReferencesFn: await import(
		"../references/functions.ts?tss-serverfn-split"
	),
	findOtusFn: await import("../otus/functions.ts?tss-serverfn-split"),
	findHmmsFn: await import("../hmm/functions.ts?tss-serverfn-split"),
	findSubtractionsFn: await import(
		"../subtraction/functions.ts?tss-serverfn-split"
	),
	findGroupsFn: await import("../groups/functions.ts?tss-serverfn-split"),
	findLabelsFn: await import("../labels/functions.ts?tss-serverfn-split"),
};
let database: TestDatabase;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	userId = await seedUser(db, { administratorRole: "users" });
}, 60_000);
afterAll(async () => {
	await database.drop();
});
beforeEach(async () => {
	vi.clearAllMocks();
	await authenticateAs(db, getRequest, userId);
});

function call(name: string, data?: unknown) {
	const module = modules[name];
	if (!module) {
		throw new Error(`Unknown server function: ${name}`);
	}
	return callServerFn(module, name, data);
}

const searches = [
	"findSamplesFn",
	"findUsersFn",
	"searchUsersFn",
	"findReferencesFn",
	"findOtusFn",
	"findHmmsFn",
	"findSubtractionsFn",
	"findGroupsFn",
	"findLabelsFn",
];
const filters = [
	{ name: "findSamplesFn", field: "labels", value: 1 },
	{ name: "findSamplesFn", field: "users", value: 1 },
	{ name: "findSamplesFn", field: "groups", value: 1 },
	{ name: "findSamplesFn", field: "workflows", value: "pathoscope:ready" },
	{ name: "findAnalysesFn", field: "userIds", value: 1 },
	{ name: "findAnalysesFn", field: "workflows", value: "pathoscope" },
];

describe("search input limits", () => {
	it.each(searches)("%s rejects an oversized term", async (name) => {
		await expect(
			call(name, { referenceId: 1, term: "x".repeat(1001) }),
		).rejects.toThrow('"code": "too_big"');
	});
	it.each(filters)(
		"$name rejects an oversized $field filter",
		async ({ name, field, value }) => {
			await expect(
				call(name, { [field]: Array(101).fill(value) }),
			).rejects.toThrow('"code": "too_big"');
		},
	);
	it("rejects an oversized sample workflow filter value", async () => {
		await expect(
			call("findSamplesFn", { workflows: ["x".repeat(101)] }),
		).rejects.toThrow('"code": "too_big"');
	});
	it("accepts a maximum-length Unicode term", async () => {
		expect(
			await call("findGroupsFn", { term: "é".repeat(1000) }),
		).toMatchObject({ items: [] });
	});
	it.each(["findSamplesFn", "findAnalysesFn"])(
		"%s accepts 100 entries per filter",
		async (name) => {
			const data = Object.fromEntries(
				filters
					.filter((filter) => filter.name === name)
					.map(({ field, value }) => [field, Array(100).fill(value)]),
			);
			expect(await call(name, data)).toMatchObject({ items: [] });
		},
	);
});

describe.each([
	{ name: "getJobsFn", field: "jobIds" },
	{ name: "getTasksFn", field: "taskIds" },
])("$name batch limits", ({ name, field }) => {
	it("accepts 100 IDs", async () => {
		expect(
			await call(name, {
				[field]: Array.from({ length: 100 }, (_, index) => index + 1),
			}),
		).toEqual([]);
	});
	it.each([0, 101])("rejects a batch of %i IDs", async (length) => {
		await expect(
			call(name, { [field]: Array.from({ length }, (_, index) => index + 1) }),
		).rejects.toThrow(
			length === 0 ? '"code": "too_small"' : '"code": "too_big"',
		);
	});
});
