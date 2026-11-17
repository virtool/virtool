import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { authSessions } from "@virtool/data/db/schema/auth";
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

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
	setContext: vi.fn(),
}));

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
const { UnauthorizedError } = await import("../auth/middleware");
const { signIn } = await import("../auth/test/fixtures");

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
	await db.delete(authSessions);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

function call(newestPostDate: unknown) {
	return callServerFn(handlers, "markChangelogSeenFn", { newestPostDate });
}

async function signInWithWatermark(lastSeenChangelogAt: Date) {
	const userId = await signIn(db, getRequest);

	await db
		.update(users)
		.set({ lastSeenChangelogAt })
		.where(eq(users.id, userId));

	return userId;
}

async function getWatermark(userId: number) {
	const [row] = await db
		.select({ lastSeenChangelogAt: users.lastSeenChangelogAt })
		.from(users)
		.where(eq(users.id, userId));

	return row?.lastSeenChangelogAt;
}

const before = new Date("2025-12-01T00:00:00.000Z");
const newest = new Date("2026-02-01T00:00:00.000Z");

describe("markChangelogSeenFn", () => {
	it("refuses an unauthenticated caller", async () => {
		await expect(call(newest)).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("moves the watermark to the given date", async () => {
		const userId = await signInWithWatermark(before);

		await call(newest);

		expect(await getWatermark(userId)).toEqual(newest);
	});

	it("does not move the watermark back", async () => {
		const userId = await signInWithWatermark(newest);

		await call(before);

		expect(await getWatermark(userId)).toEqual(newest);
	});

	it("changes only the caller's watermark", async () => {
		await signInWithWatermark(before);
		const otherUserId = await seedUser(db, { username: "bob" });
		await db
			.update(users)
			.set({ lastSeenChangelogAt: before })
			.where(eq(users.id, otherUserId));

		await call(newest);

		expect(await getWatermark(otherUserId)).toEqual(before);
	});

	it("rejects a date in the future", async () => {
		const userId = await signInWithWatermark(before);

		await expect(
			call(new Date(Date.now() + 24 * 60 * 60 * 1000)),
		).rejects.toThrow("The date must not be in the future.");
		expect(await getWatermark(userId)).toEqual(before);
	});

	it("rejects a value that is not a date", async () => {
		await signInWithWatermark(before);

		await expect(call("soon")).rejects.toThrow();
	});
});
