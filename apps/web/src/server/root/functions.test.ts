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

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { seedUser } = await import("@virtool/data/auth/test/fixtures");

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
	// No cookies: the root document is reachable without a session.
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

describe("getRoot", () => {
	it("reports firstUser when the instance has no users", async () => {
		const root = (await callServerFn(handlers, "getRootFn", undefined)) as {
			firstUser: boolean;
			version: string;
		};

		expect(root.firstUser).toBe(true);
		expect(root.version).toBe(__APP_VERSION__);
	});

	it("reports no firstUser once a user exists", async () => {
		await seedUser(db);

		const root = (await callServerFn(handlers, "getRootFn", undefined)) as {
			firstUser: boolean;
		};

		expect(root.firstUser).toBe(false);
	});
});
