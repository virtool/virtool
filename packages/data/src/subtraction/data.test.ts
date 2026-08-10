import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { jobs } from "../db/schema/jobs";
import { legacySampleSubtractions, legacySamples } from "../db/schema/samples";
import { subtractionFiles, subtractions } from "../db/schema/subtractions";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import {
	createSubtraction,
	deleteSubtraction,
	findSubtractions,
	getSubtraction,
	listSubtractionsShortlist,
	SubtractionNotFoundError,
	SubtractionUploadNotFoundError,
	updateSubtraction,
} from "./data";

let database: TestDatabase;
let db: Db;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacySampleSubtractions);
	await db.delete(subtractionFiles);
	await db.delete(subtractions);
	await db.delete(legacySamples);
	await db.delete(jobs);
	await db.delete(uploads);
	await db.delete(users);

	userId = await seedUser(db, { handle: "bob" });
});

async function seedUpload(): Promise<number> {
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

// A sample naming `subtractionId` as one of its defaults, which is what a
// subtraction's `sampleCount` counts.
async function linkSample(name: string, subtractionId: number): Promise<void> {
	const sampleId = takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({ name, library_type: "normal", created_at: new Date() })
			.returning({ id: legacySamples.id }),
	).id;

	await db
		.insert(legacySampleSubtractions)
		.values({ sample_id: sampleId, subtraction_id: subtractionId });
}

type SeedOverrides = Partial<typeof subtractions.$inferInsert>;

async function seedSubtraction(overrides: SeedOverrides = {}): Promise<number> {
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

describe("findSubtractions", () => {
	it("returns a page of subtractions with counts", async () => {
		await seedSubtraction({ name: "Arabidopsis", ready: true });
		await seedSubtraction({ name: "Human", ready: false });

		const result = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "",
			ready: false,
		});

		expect(result.totalCount).toBe(2);
		expect(result.readyCount).toBe(1);
		expect(result.foundCount).toBe(2);
		expect(result.items.map((item) => item.name)).toEqual([
			"Arabidopsis",
			"Human",
		]);
	});

	it("excludes deleted subtractions", async () => {
		await seedSubtraction({ name: "Kept" });
		await seedSubtraction({ name: "Gone", deleted: true });

		const result = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "",
			ready: false,
		});

		expect(result.totalCount).toBe(1);
		expect(result.items.map((item) => item.name)).toEqual(["Kept"]);
	});

	it("matches the search term against name and nickname", async () => {
		await seedSubtraction({ name: "Arabidopsis", nickname: "plant" });
		await seedSubtraction({ name: "Human", nickname: "mammal" });

		const byName = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "arab",
			ready: false,
		});
		expect(byName.items.map((item) => item.name)).toEqual(["Arabidopsis"]);

		const byNickname = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "mammal",
			ready: false,
		});
		expect(byNickname.items.map((item) => item.name)).toEqual(["Human"]);
	});

	it("filters to ready subtractions when asked, leaving totalCount whole", async () => {
		await seedSubtraction({ name: "Ready", ready: true });
		await seedSubtraction({ name: "Pending", ready: false });

		const result = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "",
			ready: true,
		});

		expect(result.foundCount).toBe(1);
		expect(result.totalCount).toBe(2);
		expect(result.items.map((item) => item.name)).toEqual(["Ready"]);
	});

	it("attaches the owning user and create job", async () => {
		const jobId = takeFirstOrThrow(
			await db
				.insert(jobs)
				.values({
					created_at: new Date(),
					state: "running",
					steps: [
						{
							description: "step",
							id: "s1",
							name: "s1",
							started_at: new Date().toISOString(),
						},
						{ description: "step", id: "s2", name: "s2", started_at: null },
					],
					user_id: userId,
					workflow: "create_subtraction",
				})
				.returning({ id: jobs.id }),
		).id;

		await seedSubtraction({ name: "Arabidopsis", job_id: jobId });

		const result = await findSubtractions(db, {
			page: 1,
			perPage: 25,
			term: "",
			ready: false,
		});

		const [item] = result.items;
		expect(item?.user).toEqual({ id: userId, handle: "bob" });
		expect(item?.job).toMatchObject({
			id: jobId,
			progress: 50,
			state: "running",
			workflow: "create_subtraction",
		});
	});
});

describe("listSubtractionsShortlist", () => {
	it("returns every non-deleted subtraction with its ready flag, ordered by name", async () => {
		await seedSubtraction({ name: "Zebra", ready: true });
		await seedSubtraction({ name: "Ant", ready: false });
		await seedSubtraction({ name: "Gone", deleted: true });

		const result = await listSubtractionsShortlist(db);

		expect(result).toEqual([
			{ id: expect.any(Number), name: "Ant", ready: false },
			{ id: expect.any(Number), name: "Zebra", ready: true },
		]);
	});
});

describe("getSubtraction", () => {
	it("returns the full subtraction with its files and sample count", async () => {
		const subtractionId = await seedSubtraction({
			name: "Arabidopsis",
			gc: { a: 0.25, c: 0.25, g: 0.25, t: 0.25, n: 0 },
		});

		await db.insert(subtractionFiles).values({
			name: "subtraction.fa.gz",
			subtraction_id: subtractionId,
			storage_key: `subtractions/${subtractionId}/fasta`,
			type: "fasta",
			size: 100,
		});

		await linkSample("Sample A", subtractionId);
		await linkSample("Sample B", subtractionId);

		const subtraction = await getSubtraction(db, subtractionId);

		expect(subtraction.name).toBe("Arabidopsis");
		expect(subtraction.gc).toEqual({
			a: 0.25,
			c: 0.25,
			g: 0.25,
			t: 0.25,
			n: 0,
		});
		expect(subtraction.files).toEqual([
			{
				downloadUrl: `/subtractions/${subtractionId}/files/subtraction.fa.gz`,
				id: expect.any(Number),
				name: "subtraction.fa.gz",
				size: 100,
				// Read off the row, never composed — a migrated file's object keeps
				// whatever prefix it was written under.
				storageKey: `subtractions/${subtractionId}/fasta`,
				subtraction: subtractionId,
				type: "fasta",
			},
		]);
		expect(subtraction.sampleCount).toBe(2);
	});

	it("throws when the subtraction is deleted", async () => {
		const subtractionId = await seedSubtraction({ deleted: true });

		await expect(getSubtraction(db, subtractionId)).rejects.toThrow(
			SubtractionNotFoundError,
		);
	});
});

describe("createSubtraction", () => {
	it("inserts the subtraction and a create_subtraction job", async () => {
		const uploadId = await seedUpload();

		const subtraction = await createSubtraction(db, {
			name: "Arabidopsis",
			nickname: "plant",
			uploadId,
			userId,
		});

		expect(subtraction.name).toBe("Arabidopsis");
		expect(subtraction.nickname).toBe("plant");
		expect(subtraction.ready).toBe(false);

		const jobRows = await db.select().from(jobs);
		expect(jobRows).toHaveLength(1);
		expect(jobRows[0]).toMatchObject({
			state: "pending",
			workflow: "create_subtraction",
			user_id: userId,
		});
		expect(subtraction.job?.id).toBe(jobRows[0]?.id);
	});

	it("throws when the upload does not exist", async () => {
		await expect(
			createSubtraction(db, {
				name: "Arabidopsis",
				nickname: "",
				uploadId: 999_999,
				userId,
			}),
		).rejects.toThrow(SubtractionUploadNotFoundError);

		expect(await db.select().from(subtractions)).toHaveLength(0);
		expect(await db.select().from(jobs)).toHaveLength(0);
	});
});

describe("updateSubtraction", () => {
	it("updates name and nickname", async () => {
		const subtractionId = await seedSubtraction({ name: "Old", nickname: "" });

		const subtraction = await updateSubtraction(db, subtractionId, {
			name: "New",
			nickname: "fresh",
		});

		expect(subtraction.name).toBe("New");
		expect(subtraction.nickname).toBe("fresh");
	});

	it("throws when the subtraction is absent", async () => {
		await expect(
			updateSubtraction(db, 999_999, { name: "New" }),
		).rejects.toThrow(SubtractionNotFoundError);
	});
});

describe("deleteSubtraction", () => {
	it("soft-deletes the subtraction and unlinks samples", async () => {
		const storage = new MemoryStorage();
		const subtractionId = await seedSubtraction();

		await linkSample("Sample A", subtractionId);
		await linkSample("Sample B", subtractionId);

		await deleteSubtraction(db, storage, testLogger, subtractionId);

		const [row] = await db
			.select({ deleted: subtractions.deleted })
			.from(subtractions)
			.where(eq(subtractions.id, subtractionId));
		expect(row?.deleted).toBe(true);

		expect(await db.select().from(legacySampleSubtractions)).toHaveLength(0);
	});

	// Cleanup enumerates the keys the file rows record. A migrated subtraction's
	// rows carry the legacy key they were backfilled with, which no longer bears
	// any relation to the id the subtraction is addressed by.
	it("deletes the objects its file rows name", async () => {
		const storage = new MemoryStorage();
		const subtractionId = await seedSubtraction({ legacy_id: "arabidopsis 1" });

		await db.insert(subtractionFiles).values({
			name: "subtraction.fa.gz",
			subtraction_id: subtractionId,
			storage_key: "subtractions/arabidopsis_1/subtraction.fa.gz",
			type: "fasta",
		});

		await storage.write(
			"subtractions/arabidopsis_1/subtraction.fa.gz",
			(async function* () {
				yield new TextEncoder().encode("hello");
			})(),
		);

		await deleteSubtraction(db, storage, testLogger, subtractionId);

		const remaining = [];
		for await (const object of storage.list("subtractions/")) {
			remaining.push(object.key);
		}
		expect(remaining).toEqual([]);
	});

	// Objects written before keys were recorded are not named by any row, so
	// nothing can reach them here. They are the orphan sweep's problem.
	it("leaves an object no file row names", async () => {
		const storage = new MemoryStorage();
		const subtractionId = await seedSubtraction();

		await storage.write(
			`subtractions/${subtractionId}/subtraction.fa.gz`,
			(async function* () {
				yield new TextEncoder().encode("hello");
			})(),
		);

		await deleteSubtraction(db, storage, testLogger, subtractionId);

		const remaining = [];
		for await (const object of storage.list("subtractions/")) {
			remaining.push(object.key);
		}
		expect(remaining).toEqual([
			`subtractions/${subtractionId}/subtraction.fa.gz`,
		]);
	});

	it("throws when the subtraction is already deleted", async () => {
		const storage = new MemoryStorage();
		const subtractionId = await seedSubtraction({ deleted: true });

		await expect(
			deleteSubtraction(db, storage, testLogger, subtractionId),
		).rejects.toThrow(SubtractionNotFoundError);
	});
});
