import type { Permissions } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { groups } from "@virtool/data/db/schema/groups";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	NO_PERMISSIONS,
	seedGroup as seedGroupImpl,
} from "@virtool/data/groups/test/fixtures";
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
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
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

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError, UnauthorizedError } = await import(
	"../auth/middleware"
);
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
	await db.delete(sessions);
	await db.delete(users);
	await db.delete(groups);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

/** Authenticate the next call as a user with the given administrator role. */

function seedGroup(): Promise<number> {
	return seedGroupImpl(db);
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("createGroup", () => {
	it("refuses a user with no administrator role", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("createGroupFn", { name: "hackers" }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(await db.select().from(groups)).toHaveLength(0);
	});

	it("refuses an unauthenticated caller", async () => {
		await expect(
			call("createGroupFn", { name: "hackers" }),
		).rejects.toBeInstanceOf(UnauthorizedError);
		expect(setResponseStatus).toHaveBeenCalledWith(401);
	});

	it("allows an administrator", async () => {
		await signIn(db, getRequest, { administratorRole: "base" });

		const group = (await call("createGroupFn", { name: "technicians" })) as {
			name: string;
		};

		expect(group.name).toBe("technicians");
	});
});

describe("updateGroup", () => {
	it("refuses a user with no administrator role", async () => {
		const groupId = await seedGroup();
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("updateGroupFn", { groupId, name: "renamed" }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	// The exploit itself: a group's permissions are unioned into every member's,
	// so a writable group is a self-service permission grant. Pin the row, not
	// just the status code.
	it("does not let a permissionless user grant themselves permissions", async () => {
		const groupId = await seedGroup();
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("updateGroupFn", {
				groupId,
				permissions: { create_ref: true, upload_file: true },
			}),
		).rejects.toBeInstanceOf(ForbiddenError);

		const row = takeFirstOrThrow(
			await db.select().from(groups).where(eq(groups.id, groupId)),
		);
		expect(row.permissions).toEqual(NO_PERMISSIONS);
	});

	it("allows an administrator", async () => {
		const groupId = await seedGroup();
		await signIn(db, getRequest, { administratorRole: "base" });

		const group = (await call("updateGroupFn", {
			groupId,
			permissions: { create_ref: true },
		})) as { permissions: Permissions };

		expect(group.permissions).toEqual({ ...NO_PERMISSIONS, create_ref: true });
	});
});

describe("deleteGroup", () => {
	it("refuses a user with no administrator role", async () => {
		const groupId = await seedGroup();
		await signIn(db, getRequest, { administratorRole: null });

		await expect(call("deleteGroupFn", { groupId })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
		expect(await db.select().from(groups)).toHaveLength(1);
	});

	it("allows an administrator", async () => {
		const groupId = await seedGroup();
		await signIn(db, getRequest, { administratorRole: "base" });

		await call("deleteGroupFn", { groupId });

		expect(await db.select().from(groups)).toHaveLength(0);
	});
});
