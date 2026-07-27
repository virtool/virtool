import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { sessions } from "../db/schema/sessions";
import { subtractions } from "../db/schema/subtractions";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
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
vi.mock("../db/pg", () => ({
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
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import(
	"../auth/cookies"
);
const { seedSession, seedUser } = await import("../auth/test/fixtures");

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
	await db.delete(uploads);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

// `modify_subtraction` is a "full"-role permission, so a full administrator
// holds it; a role-less user does not.
async function signIn(administratorRole: "full" | null): Promise<number> {
	const userId = await seedUser(db, { administratorRole });
	const { sessionId, token } = await seedSession(db, userId);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${sessionId}; ${SESSION_TOKEN_COOKIE}=${token}`,
			},
		}),
	);

	return userId;
}

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
		const userId = await signIn(null);
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
		const userId = await signIn("full");
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
		await signIn("full");

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
		await signIn(null);

		await expect(
			call("getSubtractionFn", { subtractionId: 999_999 }),
		).rejects.toThrow("Subtraction not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});

describe("deleteSubtraction", () => {
	it("refuses a caller without modify_subtraction", async () => {
		await signIn(null);

		await expect(
			call("deleteSubtractionFn", { subtractionId: 1 }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
