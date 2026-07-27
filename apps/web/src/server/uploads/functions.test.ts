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
import { sessions } from "../db/schema/sessions";
import { type UploadRow, uploads as uploadsTable } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { MemoryStorage } from "../storage/memory";
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

vi.mock("../events/emit", () => ({ emit: vi.fn() }));

const storage = new MemoryStorage();
vi.mock("../storage", () => ({
	storage,
	uploadFileKey: (nameOnDisk: string) => `files/${nameOnDisk}`,
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError } = await import("../auth/middleware");
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import(
	"../auth/cookies"
);
const { seedSession, seedUser } = await import("../auth/test/fixtures");

let database: TestDatabase;
let sessionCookie = "";

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	sessionCookie = "";
	await db.delete(uploadsTable);
	await db.delete(sessions);
	await db.delete(users);
	getRequest.mockImplementation(
		() =>
			new Request("https://virtool.test/_serverFn/test", {
				headers: sessionCookie ? { cookie: sessionCookie } : {},
			}),
	);
});

/** Authenticate the next call as a user with the given administrator role. */
async function signIn(administratorRole: "full" | null): Promise<number> {
	const userId = await seedUser(db, { administratorRole });
	const { sessionId, token } = await seedSession(db, userId);
	sessionCookie = `${SESSION_ID_COOKIE}=${sessionId}; ${SESSION_TOKEN_COOKIE}=${token}`;
	return userId;
}

async function seedUpload(
	userId: number,
	overrides: Partial<typeof uploadsTable.$inferInsert> = {},
): Promise<UploadRow> {
	const [row] = await db
		.insert(uploadsTable)
		.values({
			createdAt: new Date(),
			name: "reads.fq.gz",
			nameOnDisk: `disk-${Math.random()}`,
			ready: true,
			removed: false,
			reserved: false,
			size: 10,
			type: "reads",
			uploadedAt: new Date(),
			userId,
			...overrides,
		})
		.returning();
	return row as UploadRow;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("findUploads", () => {
	it("returns the visible uploads to a signed-in user", async () => {
		const userId = await signIn(null);
		await seedUpload(userId, { name: "reads.fq.gz" });

		const result = (await call("findUploadsFn", {
			page: 1,
			per_page: 25,
		})) as { items: { name: string }[] };

		expect(result.items.map((upload) => upload.name)).toEqual(["reads.fq.gz"]);
	});
});

describe("deleteUpload", () => {
	it("refuses a user without the remove_file permission", async () => {
		const userId = await signIn(null);
		const upload = await seedUpload(userId);

		await expect(
			call("deleteUploadFn", { id: upload.id }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("soft-deletes an upload for a permitted user", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId);

		await call("deleteUploadFn", { id: upload.id });

		const [row] = await db.select().from(uploadsTable);
		expect(row?.removed).toBe(true);
		expect(setResponseStatus).toHaveBeenCalledWith(204);
	});

	it("maps a missing upload to a 404", async () => {
		await signIn("full");

		await expect(call("deleteUploadFn", { id: 404 })).rejects.toThrow(
			"Upload not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("maps a reserved upload to a 409", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId, { reserved: true });

		await expect(call("deleteUploadFn", { id: upload.id })).rejects.toThrow(
			"Upload is reserved and in use.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});
