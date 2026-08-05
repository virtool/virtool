import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
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
	storage,
}));

const storage = new MemoryStorage();

const { handleUploadDownload } = await import("./download");
const { seedApiKey, seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { basicAuthHeader, sessionCookie } = await import(
	"../auth/test/fixtures"
);

let database: TestDatabase;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(uploads);
	await db.delete(apiKeys);
	await db.delete(sessions);
	await db.delete(users);

	userId = await seedUser(db);
});

async function seedUpload(
	overrides: Partial<typeof uploads.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(uploads)
			.values({
				createdAt: new Date(),
				name: "reads.fq.gz",
				nameOnDisk: "abc-reads.fq.gz",
				ready: true,
				removed: false,
				reserved: false,
				size: 5,
				storageKey: "uploads/abc",
				type: "reads",
				uploadedAt: new Date(),
				userId,
				...overrides,
			})
			.returning({ id: uploads.id }),
	).id;
}

async function write(key: string, contents: string): Promise<void> {
	await storage.write(
		key,
		(async function* () {
			yield new TextEncoder().encode(contents);
		})(),
	);
}

/** Build a `GET /uploads/{id}` request for a user. */
async function request(userId: number | null): Promise<Request> {
	const headers: Record<string, string> = {};

	if (userId !== null) {
		const { sessionId, token } = await seedSession(db, userId);
		headers.cookie = sessionCookie({ sessionId, token });
	}

	return new Request("https://virtool.test/uploads/1", { headers });
}

describe("handleUploadDownload", () => {
	it("streams the upload from the key its row records", async () => {
		const uploadId = await seedUpload();
		await write("uploads/abc", "hello");

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reads.fq.gz"',
		);
		expect(response.headers.get("content-length")).toBe("5");
		expect(response.headers.get("content-type")).toBe(
			"application/octet-stream",
		);
		expect(await response.text()).toBe("hello");
	});

	// The object's key says nothing about what the file is called; the download
	// is named after what the user chose.
	it("names the download after the upload's name, not its key", async () => {
		const uploadId = await seedUpload({
			name: "my reads.fq.gz",
			nameOnDisk: "f0e1-my reads.fq.gz",
			storageKey: "uploads/f0e1",
		});
		await write("uploads/f0e1", "hello");

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			`attachment; filename="my_reads.fq.gz"; filename*=UTF-8''my%20reads.fq.gz`,
		);
	});

	// `uploads.size` is nullable, so the header has to come from the object or
	// the client truncates.
	it("sizes the response from storage, not the row", async () => {
		const uploadId = await seedUpload({ size: null });
		await write("uploads/abc", "considerably longer than five bytes");

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-length")).toBe("35");
		expect(await response.text()).toBe("considerably longer than five bytes");
	});

	it("rejects an anonymous caller with a 401", async () => {
		const uploadId = await seedUpload();
		await write("uploads/abc", "hello");

		const response = await handleUploadDownload(
			await request(null),
			String(uploadId),
		);

		expect(response.status).toBe(401);
	});

	it("accepts an api key", async () => {
		const key = await seedApiKey(db, userId, {});
		const uploadId = await seedUpload();
		await write("uploads/abc", "hello");

		const response = await handleUploadDownload(
			new Request("https://virtool.test/uploads/1", {
				headers: { authorization: basicAuthHeader("alice", key) },
			}),
			String(uploadId),
		);

		expect(response.status).toBe(200);
	});

	it("returns a 400 for a non-numeric upload id", async () => {
		const response = await handleUploadDownload(
			await request(userId),
			"not-a-number",
		);

		expect(response.status).toBe(400);
	});

	it("returns a 404 when the upload does not exist", async () => {
		const response = await handleUploadDownload(
			await request(userId),
			"404404",
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the upload is removed", async () => {
		const uploadId = await seedUpload({ removed: true, removedAt: new Date() });
		await write("uploads/abc", "hello");

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(404);
	});

	// A row predating recorded keys names no object we can locate.
	it("returns a 404 when the row has no storage_key", async () => {
		const uploadId = await seedUpload({ storageKey: null });

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the row exists but its bytes do not", async () => {
		const uploadId = await seedUpload({ storageKey: "uploads/missing" });

		const response = await handleUploadDownload(
			await request(userId),
			String(uploadId),
		);

		expect(response.status).toBe(404);
	});
});
