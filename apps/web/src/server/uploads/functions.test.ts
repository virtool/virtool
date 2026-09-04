import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import {
	type UploadRow,
	uploads as uploadsTable,
} from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { MemoryStorage } from "@virtool/storage";
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

async function* bodyOf(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

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
	storage,
}));

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

vi.mock("../config", () => ({ config: testConfig }));

const storage = new MemoryStorage();
const presignUpload = vi.fn();
(storage as unknown as { presignUpload: unknown }).presignUpload =
	presignUpload;

// Mutable so a test can flip the chunked-upload flag; reset in `beforeEach`.
const testConfig = {
	uploadsChunked: false,
	uploadsChunkedConcurrency: 8,
};

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError } = await import("../auth/middleware");
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { sessionCookie } = await import("../auth/test/fixtures");
const { updateSettings } = await import("@virtool/data/settings/data");
const { AZURE_MAX_BLOB_SIZE, DEFAULT_MAX_UPLOAD_SIZE } = await import(
	"@virtool/contracts"
);

let database: TestDatabase;
let cookieHeader = "";

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	testConfig.uploadsChunked = false;
	cookieHeader = "";
	await db.delete(uploadsTable);
	await db.delete(sessions);
	await db.delete(users);
	// The settings row outlives the tables cleared above, so a test that moves
	// the maximum would otherwise leave it moved for its successors.
	await updateSettings(db, { maxUploadSize: DEFAULT_MAX_UPLOAD_SIZE });
	getRequest.mockImplementation(
		() =>
			new Request("https://virtool.test/_serverFn/test", {
				headers: cookieHeader ? { cookie: cookieHeader } : {},
			}),
	);
});

/** Authenticate the next call as a user with the given administrator role. */
async function signIn(administratorRole: "full" | null): Promise<number> {
	const userId = await seedUser(db, { administratorRole });
	const { sessionId, token } = await seedSession(db, userId);
	cookieHeader = sessionCookie({ sessionId, token });
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
			perPage: 25,
		})) as { items: { name: string }[] };

		expect(result.items.map((upload) => upload.name)).toEqual(["reads.fq.gz"]);
	});

	it("orders by the requested column and direction", async () => {
		const userId = await signIn(null);
		await seedUpload(userId, { name: "beta.fq.gz" });
		await seedUpload(userId, { name: "alpha.fq.gz" });

		const result = (await call("findUploadsFn", {
			page: 1,
			perPage: 25,
			sort: "name",
			direction: "ascending",
		})) as { items: { name: string }[] };

		expect(result.items.map((upload) => upload.name)).toEqual([
			"alpha.fq.gz",
			"beta.fq.gz",
		]);
	});

	// A direction on its own has nothing to order by, so it must not disturb the
	// default newest-first ordering.
	it("keeps the default order when a direction arrives without a column", async () => {
		const userId = await signIn(null);
		await seedUpload(userId, {
			name: "older.fq.gz",
			createdAt: new Date("2022-01-01T00:00:00Z"),
		});
		await seedUpload(userId, {
			name: "newer.fq.gz",
			createdAt: new Date("2022-02-01T00:00:00Z"),
		});

		const result = (await call("findUploadsFn", {
			page: 1,
			perPage: 25,
			direction: "ascending",
		})) as { items: { name: string }[] };

		expect(result.items.map((upload) => upload.name)).toEqual([
			"newer.fq.gz",
			"older.fq.gz",
		]);
	});

	it("rejects a column it does not sort by", async () => {
		await signIn(null);

		await expect(
			call("findUploadsFn", { page: 1, perPage: 25, sort: "nameOnDisk" }),
		).rejects.toThrow();
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

describe("initUpload", () => {
	it("refuses a user without the upload_file permission", async () => {
		await signIn(null);

		await expect(
			call("initUploadFn", { name: "reads.fq.gz", type: "reads", size: 5 }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("rejects initialization when direct uploads are off", async () => {
		await signIn("full");

		await expect(
			call("initUploadFn", {
				name: "reads.fq.gz",
				type: "reads",
				size: 5,
			}),
		).rejects.toThrow("Direct uploads are unavailable");
		expect(await db.select().from(uploadsTable)).toHaveLength(0);
		expect(presignUpload).not.toHaveBeenCalled();
	});

	it("reserves an unfinished row and returns the SAS when chunked is on", async () => {
		testConfig.uploadsChunked = true;
		presignUpload.mockResolvedValue("https://fd/c/blob?sig=x");
		const userId = await signIn("full");

		const result = (await call("initUploadFn", {
			name: "reads.fq.gz",
			type: "reads",
			size: 4096,
		})) as {
			uploadId: number;
			url: string;
			blockSize: number;
			concurrency: number;
		};

		expect(result.url).toBe("https://fd/c/blob?sig=x");
		expect(result.blockSize).toBe(16 * 1024 * 1024);
		expect(result.concurrency).toBe(8);

		const [row] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, result.uploadId));
		expect(row?.ready).toBe(false);
		expect(row?.userId).toBe(userId);
		expect(row?.expectedSize).toBe(4096);
		expect(presignUpload).toHaveBeenCalledWith(
			row?.storageKey,
			expect.objectContaining({ expiresIn: expect.any(Number) }),
		);
	});

	it("increases the block size for files that need more than 50,000 blocks", async () => {
		testConfig.uploadsChunked = true;
		presignUpload.mockResolvedValue("https://fd/c/blob?sig=x");
		await signIn("full");
		await updateSettings(db, { maxUploadSize: AZURE_MAX_BLOB_SIZE });

		const result = (await call("initUploadFn", {
			name: "reads.fq.gz",
			type: "reads",
			size: 16 * 1024 * 1024 * 50_000 + 1,
		})) as { blockSize: number };

		expect(result.blockSize).toBe(32 * 1024 * 1024);
	});

	it("rejects files larger than Azure's maximum block blob size", async () => {
		await signIn("full");

		await expect(
			call("initUploadFn", {
				name: "reads.fq.gz",
				type: "reads",
				size: 4_000 * 1024 * 1024 * 50_000 + 1,
			}),
		).rejects.toThrow();
	});

	it("refuses a file above the configured maximum before reserving it", async () => {
		testConfig.uploadsChunked = true;
		await signIn("full");
		await updateSettings(db, { maxUploadSize: 1024 });

		await expect(
			call("initUploadFn", { name: "reads.fq.gz", type: "reads", size: 1025 }),
		).rejects.toThrow("File exceeds the maximum upload size of 1,024 bytes.");

		expect(setResponseStatus).toHaveBeenCalledWith(413);
		expect(await db.select().from(uploadsTable)).toHaveLength(0);
		expect(presignUpload).not.toHaveBeenCalled();
	});

	it("publishes the configured maximum as the upload policy", async () => {
		await signIn(null);
		await updateSettings(db, { maxUploadSize: 1024 });

		await expect(call("getUploadPolicyFn")).resolves.toEqual({
			maxUploadSize: 1024,
		});
	});

	it("drops the reservation when presigning fails", async () => {
		testConfig.uploadsChunked = true;
		presignUpload.mockRejectedValue(new Error("presign failed"));
		await signIn("full");

		await expect(
			call("initUploadFn", { name: "reads.fq.gz", type: "reads", size: 4096 }),
		).rejects.toThrow("presign failed");

		const rows = await db.select().from(uploadsTable);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.removed).toBe(true);
	});
});

describe("finalizeChunkedUpload", () => {
	it("marks the caller's upload ready from the stored size", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId, {
			ready: false,
			storageKey: "uploads/finalize",
		});
		await storage.write("uploads/finalize", bodyOf("hello"));

		const result = (await call("finalizeChunkedUploadFn", {
			id: upload.id,
		})) as { ready: boolean; size: number };

		expect(result).toMatchObject({ ready: true, size: 5 });
	});

	it("maps an upload whose bytes never arrived to a 409", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId, {
			ready: false,
			storageKey: "uploads/missing",
		});

		await expect(
			call("finalizeChunkedUploadFn", { id: upload.id }),
		).rejects.toThrow("Upload is not complete.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("maps a commit that does not match the declared size to a 409", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId, {
			ready: false,
			storageKey: "uploads/short",
			expectedSize: 5,
		});
		await storage.write("uploads/short", bodyOf("hi"));

		await expect(
			call("finalizeChunkedUploadFn", { id: upload.id }),
		).rejects.toThrow("Upload size does not match the declared size.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});

describe("cancelChunkedUpload", () => {
	it("soft-deletes the caller's unfinished upload", async () => {
		const userId = await signIn("full");
		const upload = await seedUpload(userId, {
			ready: false,
			storageKey: "uploads/cancel",
		});

		await call("cancelChunkedUploadFn", { id: upload.id });

		const [row] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, upload.id));
		expect(row?.removed).toBe(true);
	});
});
