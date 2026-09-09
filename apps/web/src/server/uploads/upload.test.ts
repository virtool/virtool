import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { uploads } from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { MemoryStorage } from "@virtool/storage";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest: vi.fn(),
	setCookie: vi.fn(),
}));
vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));
vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

let db: Db;
const storage = new MemoryStorage();
const presignUpload = vi.fn();
(storage as unknown as { presignUpload: unknown }).presignUpload =
	presignUpload;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
	storage,
}));
vi.mock("../config", () => ({
	config: { uploadsChunked: true, uploadsChunkedConcurrency: 4 },
}));

const { handleUploadCancel, handleUploadFinalize, handleUploadInitialize } =
	await import("./upload");
const { seedApiKey, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { updateSettings } = await import("@virtool/data/settings/data");
const { MAX_UPLOAD_SIZE, DEFAULT_MAX_UPLOAD_SIZE } = await import(
	"@virtool/contracts"
);
const { basicAuthHeader } = await import("../auth/test/fixtures");
let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => database.drop());

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(uploads);
	await db.delete(apiKeys);
	await db.delete(users);
	presignUpload.mockResolvedValue("https://storage.test/blob?sig=test");
	// The settings row outlives the tables cleared above, so a test that lowers
	// the maximum would otherwise leave it lowered for its successors.
	await updateSettings(db, { maxUploadSize: DEFAULT_MAX_UPLOAD_SIZE });
});

async function authenticatedRequest(method: string, body?: unknown) {
	const userId = await seedUser(db, { administratorRole: "full" });
	const key = await seedApiKey(db, userId, { upload_file: true });
	return {
		request: new Request("https://virtool.test/api/v1/uploads", {
			method,
			headers: {
				authorization: basicAuthHeader("alice", key),
				"content-type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
		userId,
	};
}

describe("public upload lifecycle", () => {
	it("initializes a direct upload for an API key", async () => {
		const { request, userId } = await authenticatedRequest("POST", {
			name: "reads.fq.gz",
			type: "reads",
			size: 5,
		});
		const response = await handleUploadInitialize(request);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			url: "https://storage.test/blob?sig=test",
			blockSize: 16 * 1024 * 1024,
			concurrency: 4,
		});
		const [row] = await db.select().from(uploads);
		expect(row).toMatchObject({ expectedSize: 5, ready: false, userId });
	});

	it.each([1025, MAX_UPLOAD_SIZE + 1])(
		"refuses a declared size of %s above the configured maximum before reserving it",
		async (size) => {
			await updateSettings(db, { maxUploadSize: 1024 });

			const { request } = await authenticatedRequest("POST", {
				name: "reads.fq.gz",
				type: "reads",
				size,
			});
			const response = await handleUploadInitialize(request);

			expect(response.status).toBe(413);
			expect(await response.json()).toEqual({
				message: "File exceeds the maximum upload size of 1,024 bytes.",
			});
			await expect(db.select().from(uploads)).resolves.toHaveLength(0);
			expect(presignUpload).not.toHaveBeenCalled();
		},
	);

	it("rejects the removed raw-body contract", async () => {
		const { request } = await authenticatedRequest("POST", "file bytes");
		expect((await handleUploadInitialize(request)).status).toBe(422);
	});

	it("finalizes a complete upload", async () => {
		const { request: initRequest, userId } = await authenticatedRequest(
			"POST",
			{ name: "reads.fq.gz", type: "reads", size: 5 },
		);
		const init = (await (await handleUploadInitialize(initRequest)).json()) as {
			uploadId: number;
		};
		const [row] = await db.select().from(uploads);
		await storage.write(
			row?.storageKey ?? "",
			(async function* () {
				yield new TextEncoder().encode("hello");
			})(),
		);
		const key = await seedApiKey(db, userId, { upload_file: true });
		const request = new Request(
			"https://virtool.test/api/v1/uploads/1/finalize",
			{
				method: "POST",
				headers: { authorization: basicAuthHeader("alice", key) },
			},
		);

		const response = await handleUploadFinalize(request, String(init.uploadId));
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ready: true, size: 5 });
	});

	it("cancels an unfinished upload", async () => {
		const { request: initRequest, userId } = await authenticatedRequest(
			"POST",
			{ name: "reads.fq.gz", type: "reads", size: 5 },
		);
		const init = (await (await handleUploadInitialize(initRequest)).json()) as {
			uploadId: number;
		};
		const key = await seedApiKey(db, userId, { upload_file: true });
		const request = new Request("https://virtool.test/api/v1/uploads/1", {
			method: "DELETE",
			headers: { authorization: basicAuthHeader("alice", key) },
		});

		expect(
			(await handleUploadCancel(request, String(init.uploadId))).status,
		).toBe(204);
		const [row] = await db.select().from(uploads);
		expect(row?.removed).toBe(true);
	});
});
