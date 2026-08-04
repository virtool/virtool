import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { analyses } from "@virtool/data/db/schema/analyses";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import {
	legacySampleLabels,
	legacySampleSubtractions,
	legacySamples,
	sampleArtifacts,
	sampleReads,
	sampleUploads,
} from "@virtool/data/db/schema/samples";
import { sessions } from "@virtool/data/db/schema/sessions";
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

const { handleSampleReads } = await import("./download");
const { seedApiKey, seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { basicAuthHeader, sessionCookie } = await import(
	"../auth/test/fixtures"
);
const { addToGroup, seedGroup } = await import(
	"@virtool/data/groups/test/fixtures"
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
	await db.delete(analyses);
	await db.delete(legacySampleLabels);
	await db.delete(legacySampleSubtractions);
	await db.delete(sampleUploads);
	await db.delete(sampleArtifacts);
	await db.delete(sampleReads);
	await db.delete(legacySamples);
	await db.delete(apiKeys);
	await db.delete(sessions);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);

	ownerId = await seedUser(db, { handle: "alice" });
});

async function seedSample(
	overrides: Partial<typeof legacySamples.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({
				name: "Sample",
				library_type: "normal",
				created_at: new Date(),
				user_id: ownerId,
				...overrides,
			})
			.returning({ id: legacySamples.id }),
	).id;
}

// `sample_reads.sample` is the storage prefix the file was written under, which
// is the legacy id for a migrated sample and the integer id otherwise.
async function seedRead(
	sampleId: number,
	{
		name = "reads_1.fq.gz",
		nameOnDisk = name,
		sample = String(sampleId),
	}: { name?: string; nameOnDisk?: string; sample?: string } = {},
): Promise<void> {
	await db.insert(sampleReads).values({
		name,
		name_on_disk: nameOnDisk,
		sample,
		sample_id: sampleId,
		size: 5,
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

/** Build a `GET /samples/{id}/reads/{filename}` request for a user. */
async function request(userId: number | null): Promise<Request> {
	const headers: Record<string, string> = {};

	if (userId !== null) {
		const { sessionId, token } = await seedSession(db, userId);
		headers.cookie = sessionCookie({ sessionId, token });
	}

	return new Request("https://virtool.test/samples/1/reads/x", { headers });
}

describe("handleSampleReads", () => {
	it("streams a Postgres-native sample's read from its integer prefix", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);
		await write(`samples/${sampleId}/reads_1.fq.gz`, "hello");

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reads_1.fq.gz"',
		);
		expect(response.headers.get("content-length")).toBe("5");
		expect(response.headers.get("content-type")).toBe("application/gzip");
		expect(await response.text()).toBe("hello");
	});

	// A sample migrated out of Mongo keeps its legacy id as the storage prefix,
	// even though it is addressed by its integer id.
	it("reads a migrated sample's read from its legacy prefix", async () => {
		const sampleId = await seedSample({ legacy_id: "abc123" });
		await seedRead(sampleId, { sample: "abc123" });
		await write("samples/abc123/reads_1.fq.gz", "hello");

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello");
	});

	// `upload_reads` sets `name` and `name_on_disk` from the same argument, so
	// the two agree on every row today. The URL still carries `name`, so the
	// match and the key have to come from different columns for that to stay an
	// implementation detail rather than something the route depends on.
	it("matches on name but keys the object on name_on_disk", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId, { nameOnDisk: "stored_1.fq.gz" });
		await write(`samples/${sampleId}/stored_1.fq.gz`, "hello");

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello");
		// The download is still named for the public name, not the stored one.
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reads_1.fq.gz"',
		);
	});

	// `sample_reads.size` records what the create job wrote and is nullable, so
	// the header has to come from the object or the client truncates.
	it("sizes the response from storage, not the row", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);
		await db.update(sampleReads).set({ size: null });
		await write(
			`samples/${sampleId}/reads_1.fq.gz`,
			"considerably longer than five bytes",
		);

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-length")).toBe("35");
		expect(await response.text()).toBe("considerably longer than five bytes");
	});

	it("rejects an anonymous caller with a 401", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);

		const response = await handleSampleReads(
			await request(null),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(401);
	});

	it("accepts an api key", async () => {
		const key = await seedApiKey(db, ownerId, {});
		const sampleId = await seedSample();
		await seedRead(sampleId);
		await write(`samples/${sampleId}/reads_1.fq.gz`, "hello");

		const response = await handleSampleReads(
			new Request("https://virtool.test/samples/1/reads/x", {
				headers: { authorization: basicAuthHeader("alice", key) },
			}),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
	});

	// The Python endpoint this replaces checked only the session, which let any
	// signed-in caller download the reads of a sample they could not see.
	it("rejects a user without the read right with a 403", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);
		await write(`samples/${sampleId}/reads_1.fq.gz`, "hello");

		const strangerId = await seedUser(db, { handle: "bob" });

		const response = await handleSampleReads(
			await request(strangerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(403);
	});

	it("serves a member of the sample's group when it grants group read", async () => {
		const groupId = await seedGroup(db, { name: "lab" });
		const sampleId = await seedSample({ group_id: groupId, group_read: true });
		await seedRead(sampleId);
		await write(`samples/${sampleId}/reads_1.fq.gz`, "hello");

		const memberId = await seedUser(db, { handle: "bob" });
		await addToGroup(db, memberId, groupId);

		const response = await handleSampleReads(
			await request(memberId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(200);
	});

	it("returns a 400 for a non-numeric sample id", async () => {
		const response = await handleSampleReads(
			await request(ownerId),
			"not-a-number",
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(400);
	});

	it("returns a 404 when the sample does not exist", async () => {
		const response = await handleSampleReads(
			await request(ownerId),
			"404404",
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(404);
	});

	// The filename only ever reaches a key after it has matched a registered
	// read, so it cannot escape the sample's prefix.
	it("returns a 404 for a filename the sample has no row for", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"../../etc/passwd",
		);

		expect(response.status).toBe(404);
	});

	it("returns a 404 when the row exists but its bytes do not", async () => {
		const sampleId = await seedSample();
		await seedRead(sampleId);

		const response = await handleSampleReads(
			await request(ownerId),
			String(sampleId),
			"reads_1.fq.gz",
		);

		expect(response.status).toBe(404);
	});
});
