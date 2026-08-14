import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { jobs } from "@virtool/data/db/schema/jobs";
import { sessions } from "@virtool/data/db/schema/sessions";
import { subtractions } from "@virtool/data/db/schema/subtractions";
import { uploads } from "@virtool/data/db/schema/uploads";
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
	await db.delete(subtractions);
	await db.delete(jobs);
	await db.delete(uploads);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

// `modify_subtraction` is a "full"-role permission, so a full administrator
// holds it; a role-less user does not.

async function seedUpload(userId: number): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(uploads)
			.values({
				createdAt: new Date(),
				name: "genome.fa.gz",
				nameOnDisk: `disk-${Math.random()}`,
				userId,
			})
			.returning({ id: uploads.id }),
	).id;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("createSubtraction", () => {
	it("refuses a caller without modify_subtraction", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const uploadId = await seedUpload(userId);

		await expect(
			call("createSubtractionFn", {
				name: "Arabidopsis",
				nickname: "",
				uploadId,
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.select().from(subtractions)).toHaveLength(0);
	});

	it("refuses an unauthenticated caller", async () => {
		await expect(
			call("createSubtractionFn", {
				name: "Arabidopsis",
				nickname: "",
				uploadId: 1,
			}),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("creates a subtraction for a permitted caller", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: "full" });
		const uploadId = await seedUpload(userId);

		const subtraction = (await call("createSubtractionFn", {
			name: "Arabidopsis",
			nickname: "plant",
			uploadId,
		})) as { name: string; nickname: string };

		expect(subtraction.name).toBe("Arabidopsis");
		expect(subtraction.nickname).toBe("plant");
		expect(setResponseStatus).toHaveBeenCalledWith(201);
	});

	it("maps a missing upload to a 400", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("createSubtractionFn", {
				name: "Arabidopsis",
				nickname: "",
				uploadId: 999_999,
			}),
		).rejects.toThrow("Upload does not exist.");
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});
});

describe("getSubtraction", () => {
	it("maps a missing subtraction to a 404", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("getSubtractionFn", { subtractionId: 999_999 }),
		).rejects.toThrow("Subtraction not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});

describe("deleteSubtraction", () => {
	it("refuses a caller without modify_subtraction", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("deleteSubtractionFn", { subtractionId: 1 }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
