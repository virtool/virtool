import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
import {
	subtractionFiles,
	subtractions,
} from "@virtool/data/db/schema/subtractions";
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

const { handleSubtractionFile } = await import("./download");
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
	await db.delete(subtractionFiles);
	await db.delete(subtractions);
	await db.delete(apiKeys);
	await db.delete(sessions);
	await db.delete(users);

	userId = await seedUser(db);
});

async function seedSubtraction(
	overrides: Partial<typeof subtractions.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(subtractions)
			.values({
				name: "Arabidopsis",
				nickname: "",
				created_at: new Date(),
				ready: true,
				user_id: userId,
				...overrides,
			})
			.returning({ id: subtractions.id }),
	).id;
}

async function seedFile(
	subtractionId: number,
	name = "subtraction.fa.gz",
): Promise<void> {
	await db.insert(subtractionFiles).values({
		name,
		subtraction_id: subtractionId,
		size: 5,
		type: "fasta",
	});
}

async function write(key: string, contents: string): Promise<void> {
	await storage.write(
		key,
		(async function* () {
			yield new TextEncoder().encode(contents);
		})(),
	);
}

/** Build a `GET /subtractions/{id}/files/{filename}` request for a user. */
async function request(userId: number | null): Promise<Request> {
	const headers: Record<string, string> = {};

	if (userId !== null) {
		const { sessionId, token } = await seedSession(db, userId);
		headers.cookie = sessionCookie({ sessionId, token });
	}

	return new Request("https://virtool.test/subtractions/1/files/x", {
		headers,
	});
}

describe("handleSubtractionFile", () => {
	it("streams a Postgres-native subtraction's file from its integer prefix", async () => {
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);
		await write(`subtractions/${subtractionId}/subtraction.fa.gz`, "hello");

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="subtraction.fa.gz"',
		);
		expect(response.headers.get("content-length")).toBe("5");
		expect(response.headers.get("content-type")).toBe(
			"application/octet-stream",
		);
		expect(await response.text()).toBe("hello");
	});

	// A subtraction migrated out of Mongo keeps its legacy slug as the storage
	// prefix, even though it is addressed by its integer id.
	it("reads a migrated subtraction's file from its legacy prefix", async () => {
		const subtractionId = await seedSubtraction({ legacy_id: "arabidopsis 1" });
		await seedFile(subtractionId);
		await write("subtractions/arabidopsis_1/subtraction.fa.gz", "hello");

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello");
	});

	// `subtraction_files.size` records what the create job wrote and is nullable,
	// so the header has to come from the object or the client truncates.
	it("sizes the response from storage, not the row", async () => {
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);
		await db
			.update(subtractionFiles)
			.set({ size: null })
			.where(eq(subtractionFiles.subtraction_id, subtractionId));
		await write(
			`subtractions/${subtractionId}/subtraction.fa.gz`,
			"considerably longer than five bytes",
		);

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-length")).toBe("35");
		expect(await response.text()).toBe("considerably longer than five bytes");
	});

	it("rejects an anonymous caller with a 401", async () => {
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);

		const response = await handleSubtractionFile(
			await request(null),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(401);
	});

	it("accepts an api key", async () => {
		const key = await seedApiKey(db, userId, {});
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);
		await write(`subtractions/${subtractionId}/subtraction.fa.gz`, "hello");

		const response = await handleSubtractionFile(
			new Request("https://virtool.test/subtractions/1/files/x", {
				headers: { authorization: basicAuthHeader("alice", key) },
			}),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(200);
	});

	it("returns a 400 for a non-numeric subtraction id", async () => {
		const response = await handleSubtractionFile(
			await request(userId),
			"not-a-number",
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(400);
	});

	it("returns a 404 when the subtraction does not exist", async () => {
		const response = await handleSubtractionFile(
			await request(userId),
			"404404",
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the subtraction is deleted", async () => {
		const subtractionId = await seedSubtraction({ deleted: true });
		await seedFile(subtractionId);
		await write(`subtractions/${subtractionId}/subtraction.fa.gz`, "hello");

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(404);
	});

	// The filename only ever reaches a key after it has matched a registered
	// file, so it cannot escape the subtraction's prefix.
	it("returns a 404 for a filename the subtraction has no row for", async () => {
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"../../etc/passwd",
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the row exists but its bytes do not", async () => {
		const subtractionId = await seedSubtraction();
		await seedFile(subtractionId);

		const response = await handleSubtractionFile(
			await request(userId),
			String(subtractionId),
			"subtraction.fa.gz",
		);

		expect(response.status).toBe(404);
	});
});
