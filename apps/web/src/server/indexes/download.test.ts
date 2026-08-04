import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import { legacyHistory } from "@virtool/data/db/schema/history";
import { indexes, indexFiles } from "@virtool/data/db/schema/indexes";
import { legacyOtus } from "@virtool/data/db/schema/otus";
import {
	legacyReferenceGroups,
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { sessions } from "@virtool/data/db/schema/sessions";
import { tasks } from "@virtool/data/db/schema/tasks";
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

const { handleIndexFile } = await import("./download");
const { seedApiKey, seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { basicAuthHeader, sessionCookie } = await import(
	"../auth/test/fixtures"
);
const { seedIndex, seedReference } = await import(
	"@virtool/data/indexes/test/fixtures"
);

let database: TestDatabase;
let ownerId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(indexFiles);
	await db.delete(legacyHistory);
	await db.delete(legacyOtus);
	await db.delete(indexes);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferenceGroups);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(apiKeys);
	await db.delete(sessions);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);

	ownerId = await seedUser(db, { handle: "alice" });
});

async function seedFile(
	indexId: number,
	name = "reference.fa.gz",
): Promise<void> {
	await db.insert(indexFiles).values({
		name,
		index_id: indexId,
		size: 5,
		type: "fasta",
	});
}

// `storage_key` is minted by the seeder and cannot be derived from the row id,
// so the key a test writes under has to be read back.
async function storageKey(indexId: number): Promise<string> {
	return takeFirstOrThrow(
		await db
			.select({ storageKey: indexes.storage_key })
			.from(indexes)
			.where(eq(indexes.id, indexId)),
	).storageKey;
}

async function write(key: string, contents: string): Promise<void> {
	await storage.write(
		key,
		(async function* () {
			yield new TextEncoder().encode(contents);
		})(),
	);
}

/** Build a `GET /indexes/{id}/files/{filename}` request for a user. */
async function request(userId: number | null): Promise<Request> {
	const headers: Record<string, string> = {};

	if (userId !== null) {
		const { sessionId, token } = await seedSession(db, userId);
		headers.cookie = sessionCookie({ sessionId, token });
	}

	return new Request("https://virtool.test/indexes/1/files/x", { headers });
}

/** Seed a reference owned by `ownerId` with one finished build and its file. */
async function seedBuild(): Promise<{ referenceId: number; indexId: number }> {
	const referenceId = await seedReference(db, ownerId);
	const indexId = await seedIndex(db, {
		referenceId,
		userId: ownerId,
		version: 0,
	});

	await seedFile(indexId);
	await write(`indexes/${await storageKey(indexId)}/reference.fa.gz`, "hello");

	return { referenceId, indexId };
}

describe("handleIndexFile", () => {
	it("streams a build's file from its storage-key prefix", async () => {
		const { indexId } = await seedBuild();

		const response = await handleIndexFile(
			await request(ownerId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reference.fa.gz"',
		);
		expect(response.headers.get("content-length")).toBe("5");
		expect(response.headers.get("content-type")).toBe(
			"application/octet-stream",
		);
		expect(await response.text()).toBe("hello");
	});

	// `index_files.size` records what the build task wrote and is nullable, so the
	// header has to come from the object or the client truncates.
	it("sizes the response from storage, not the row", async () => {
		const { indexId } = await seedBuild();
		await db
			.update(indexFiles)
			.set({ size: null })
			.where(eq(indexFiles.index_id, indexId));
		await write(
			`indexes/${await storageKey(indexId)}/reference.fa.gz`,
			"considerably longer than five bytes",
		);

		const response = await handleIndexFile(
			await request(ownerId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-length")).toBe("35");
		expect(await response.text()).toBe("considerably longer than five bytes");
	});

	it("rejects an anonymous caller with a 401", async () => {
		const { indexId } = await seedBuild();

		const response = await handleIndexFile(
			await request(null),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(401);
	});

	it("accepts an api key", async () => {
		const key = await seedApiKey(db, ownerId, {});
		const { indexId } = await seedBuild();

		const response = await handleIndexFile(
			new Request("https://virtool.test/indexes/1/files/x", {
				headers: { authorization: basicAuthHeader("alice", key) },
			}),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(200);
	});

	// An index is only as visible as the reference it was built from. Dropping
	// this check would expose every reference's builds to any signed-in user.
	it("rejects a user who cannot see the reference with a 403", async () => {
		const { indexId } = await seedBuild();
		const strangerId = await seedUser(db, { handle: "bob" });

		const response = await handleIndexFile(
			await request(strangerId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(403);
	});

	it("serves a user holding a membership row on the reference", async () => {
		const { referenceId, indexId } = await seedBuild();
		const memberId = await seedUser(db, { handle: "bob" });

		// Membership alone grants read; none of the rights flags is set.
		await db.insert(legacyReferenceUsers).values({
			reference_id: referenceId,
			user_id: memberId,
			build: false,
			modify: false,
			modify_otu: false,
		});

		const response = await handleIndexFile(
			await request(memberId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(200);
	});

	it("serves a full administrator who is not a member", async () => {
		const { indexId } = await seedBuild();
		const adminId = await seedUser(db, {
			handle: "bob",
			administratorRole: "full",
		});

		const response = await handleIndexFile(
			await request(adminId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(200);
	});

	it("returns a 400 for a non-numeric index id", async () => {
		const response = await handleIndexFile(
			await request(ownerId),
			"not-a-number",
			"reference.fa.gz",
		);

		expect(response.status).toBe(400);
	});

	it("returns a 404 when the index does not exist", async () => {
		const response = await handleIndexFile(
			await request(ownerId),
			"404404",
			"reference.fa.gz",
		);

		expect(response.status).toBe(404);
	});

	// The name whitelist keeps a build's other artifacts unreachable even once a
	// row exists for them.
	it("returns a 404 for a file the whitelist does not name", async () => {
		const { indexId } = await seedBuild();
		await seedFile(indexId, "secret.txt");
		await write(`indexes/${await storageKey(indexId)}/secret.txt`, "hello");

		const response = await handleIndexFile(
			await request(ownerId),
			String(indexId),
			"secret.txt",
		);

		expect(response.status).toBe(404);
	});

	// The filename only ever reaches a key after it has matched a registered
	// file, so it cannot escape the index's prefix.
	it("returns a 404 for a filename the index has no row for", async () => {
		const { indexId } = await seedBuild();

		const response = await handleIndexFile(
			await request(ownerId),
			String(indexId),
			"../../etc/passwd",
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the row exists but its bytes do not", async () => {
		const referenceId = await seedReference(db, ownerId);
		const indexId = await seedIndex(db, {
			referenceId,
			userId: ownerId,
			version: 0,
		});
		await seedFile(indexId);

		const response = await handleIndexFile(
			await request(ownerId),
			String(indexId),
			"reference.fa.gz",
		);

		expect(response.status).toBe(404);
	});
});
