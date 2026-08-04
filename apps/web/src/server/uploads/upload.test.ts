import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
import { uploads as uploadsTable } from "@virtool/data/db/schema/uploads";
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

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

const storage = new MemoryStorage();

const { handleUpload } = await import("./upload");
const { seedApiKey, seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { basicAuthHeader, sessionCookie } = await import(
	"../auth/test/fixtures"
);

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
	await db.delete(uploadsTable);
	await db.delete(apiKeys);
	await db.delete(sessions);
	await db.delete(users);
});

/** Build a `POST /uploads` request authenticated as the given user. */
async function request(
	userId: number | null,
	query: string,
	body: string | null = "hello",
): Promise<Request> {
	const headers: Record<string, string> = {};
	if (userId !== null) {
		const { sessionId, token } = await seedSession(db, userId);
		headers.cookie = sessionCookie({ sessionId, token });
	}
	return new Request(`https://virtool.test/uploads${query}`, {
		method: "POST",
		body,
		headers,
	});
}

describe("handleUpload", () => {
	it("streams the body to storage and returns the created upload", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });

		const response = await handleUpload(
			await request(userId, "?name=external.fa.gz&type=reference"),
		);

		expect(response.status).toBe(201);
		const body = (await response.json()) as { name: string; size: number };
		expect(body).toMatchObject({ name: "external.fa.gz", size: 5 });
		expect(await db.select().from(uploadsTable)).toHaveLength(1);
	});

	it("rejects an anonymous caller with a 401", async () => {
		const response = await handleUpload(
			await request(null, "?name=x&type=reference"),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(uploadsTable)).toHaveLength(0);
	});

	it("rejects a user without the upload_file permission with a 403", async () => {
		const userId = await seedUser(db, { administratorRole: null });

		const response = await handleUpload(
			await request(userId, "?name=x&type=reference"),
		);

		expect(response.status).toBe(403);
		expect(await db.select().from(uploadsTable)).toHaveLength(0);
	});

	it("rejects an invalid type with a 422", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });

		const response = await handleUpload(
			await request(userId, "?name=x&type=bogus"),
		);

		expect(response.status).toBe(422);
	});

	it("rejects a request with no body with a 400", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });

		const response = await handleUpload(
			await request(userId, "?name=x&type=reference", null),
		);

		expect(response.status).toBe(400);
	});
});

describe("handleUpload with an api key", () => {
	/** Build a `POST /uploads` request authenticated with an Authorization header. */
	function keyRequest(authorization: string): Request {
		return new Request(
			"https://virtool.test/uploads?name=external.fa.gz&type=reference",
			{ method: "POST", body: "hello", headers: { authorization } },
		);
	}

	it("accepts a key granted upload_file", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });
		const key = await seedApiKey(db, userId, { upload_file: true });

		const response = await handleUpload(
			keyRequest(basicAuthHeader("alice", key)),
		);

		expect(response.status).toBe(201);
		const [row] = await db.select().from(uploadsTable);
		expect(row?.userId).toBe(userId);
	});

	it("rejects a key without upload_file with a 403", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });
		const key = await seedApiKey(db, userId, { create_sample: true });

		const response = await handleUpload(
			keyRequest(basicAuthHeader("alice", key)),
		);

		expect(response.status).toBe(403);
		expect(await db.select().from(uploadsTable)).toHaveLength(0);
	});

	// The key permits it, but the user themself does not, so neither does the
	// intersection.
	it("rejects a key whose owner lacks upload_file with a 403", async () => {
		const userId = await seedUser(db);
		const key = await seedApiKey(db, userId, { upload_file: true });

		const response = await handleUpload(
			keyRequest(basicAuthHeader("alice", key)),
		);

		expect(response.status).toBe(403);
	});

	it("rejects an unknown key with a 401", async () => {
		await seedUser(db, { administratorRole: "full" });

		const response = await handleUpload(
			keyRequest(basicAuthHeader("alice", "not-a-key")),
		);

		expect(response.status).toBe(401);
	});

	it("rejects a key belonging to a deactivated user with a 401", async () => {
		const userId = await seedUser(db, {
			active: false,
			administratorRole: "full",
		});
		const key = await seedApiKey(db, userId, { upload_file: true });

		const response = await handleUpload(
			keyRequest(basicAuthHeader("alice", key)),
		);

		expect(response.status).toBe(401);
	});

	it("rejects a malformed authorization header with a 401", async () => {
		const userId = await seedUser(db, { administratorRole: "full" });
		await seedApiKey(db, userId, { upload_file: true });

		const response = await handleUpload(keyRequest("Bearer nonsense"));

		expect(response.status).toBe(401);
	});
});
