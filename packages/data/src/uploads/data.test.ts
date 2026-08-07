import type { UploadType } from "@virtool/contracts";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { type UploadRow, uploads as uploadsTable } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import {
	createUpload,
	deleteUpload,
	findUploads,
	UploadNotFoundError,
	UploadReservedError,
} from "./data";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(uploadsTable);
	await db.delete(users);
});

async function* bodyOf(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

type SeedOverrides = Partial<typeof uploadsTable.$inferInsert>;

async function seedUpload(
	userId: number,
	overrides: SeedOverrides = {},
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
			storageKey: `uploads/${Math.random()}`,
			type: "reads",
			uploadedAt: new Date(),
			userId,
			...overrides,
		})
		.returning();
	return row as UploadRow;
}

describe("createUpload", () => {
	it("writes the body to storage and inserts a ready row", async () => {
		const userId = await seedUser(db, { handle: "bob" });
		const storage = new MemoryStorage();

		const upload = await createUpload(db, storage, {
			name: "external.fa.gz",
			type: "reference",
			userId,
			body: bodyOf("hello"),
		});

		expect(upload).toMatchObject({
			name: "external.fa.gz",
			type: "reference",
			ready: true,
			removed: false,
			reserved: false,
			size: 5,
			user: { id: userId, handle: "bob" },
		});

		const [row] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, upload.id));

		expect(row?.ready).toBe(true);
		expect(row?.storageKey).toMatch(/^uploads\/[0-9a-f]{32}$/);
		expect(await storage.size(row?.storageKey ?? "")).toBe(5);
	});

	it("never exposes name_on_disk", async () => {
		const userId = await seedUser(db);
		const upload = await createUpload(db, new MemoryStorage(), {
			name: "external.fa.gz",
			type: "reference",
			userId,
			body: bodyOf("hello"),
		});

		expect(upload).not.toHaveProperty("name_on_disk");
	});
});

describe("findUploads", () => {
	it("returns only ready, un-removed, un-reserved uploads, newest first", async () => {
		const userId = await seedUser(db, { handle: "bob" });

		const older = await seedUpload(userId, {
			name: "older.fq.gz",
			createdAt: new Date("2022-01-01T00:00:00Z"),
		});
		const newer = await seedUpload(userId, {
			name: "newer.fq.gz",
			createdAt: new Date("2022-02-01T00:00:00Z"),
		});
		await seedUpload(userId, { name: "pending.fq.gz", ready: false });
		await seedUpload(userId, { name: "gone.fq.gz", removed: true });
		await seedUpload(userId, { name: "held.fq.gz", reserved: true });

		const result = await findUploads(db, undefined, 1, 25);

		expect(result.items.map((upload) => upload.id)).toEqual([
			newer.id,
			older.id,
		]);
		expect(result.foundCount).toBe(2);
		expect(result.totalCount).toBe(2);
		expect(result.items[0]?.user).toEqual({ id: userId, handle: "bob" });
	});

	// A ready row migrated from before these columns existed carries null. The
	// mapper must pass that through rather than substitute an epoch date, which
	// renders as a real instant in 1970 instead of as the absence it is — and
	// which no type check can catch, because `Date` satisfies `Date | null`.
	it("passes a null timestamp through rather than defaulting it", async () => {
		const userId = await seedUser(db);

		await seedUpload(userId, { createdAt: null, uploadedAt: null });

		const result = await findUploads(db, undefined, 1, 25);

		expect(result.items[0]?.createdAt).toBeNull();
		expect(result.items[0]?.uploadedAt).toBeNull();
	});

	it("filters by type while counting all visible uploads as the total", async () => {
		const userId = await seedUser(db);
		await seedUpload(userId, { type: "reads" });
		await seedUpload(userId, { type: "reference" });

		const result = await findUploads(db, "reference" as UploadType, 1, 25);

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.type).toBe("reference");
		expect(result.foundCount).toBe(1);
		expect(result.totalCount).toBe(2);
	});

	it("filters by user", async () => {
		const bob = await seedUser(db, { handle: "bob" });
		const alice = await seedUser(db, { handle: "alice" });
		await seedUpload(bob);
		await seedUpload(alice);

		const result = await findUploads(db, undefined, 1, 25, alice);

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.user).toEqual({ id: alice, handle: "alice" });
	});
});

describe("deleteUpload", () => {
	it("soft-deletes the row and removes the stored file", async () => {
		const userId = await seedUser(db);
		const storage = new MemoryStorage();
		const upload = await createUpload(db, storage, {
			name: "external.fa.gz",
			type: "reference",
			userId,
			body: bodyOf("hello"),
		});
		const [before] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, upload.id));
		const key = before?.storageKey ?? "";

		await deleteUpload(db, storage, testLogger, upload.id);

		const [after] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, upload.id));

		expect(after?.removed).toBe(true);
		expect(after?.removedAt).not.toBeNull();
		await expect(storage.size(key)).rejects.toThrow();
	});

	it("throws when the upload is missing or already removed", async () => {
		const userId = await seedUser(db);
		const removed = await seedUpload(userId, { removed: true });

		await expect(
			deleteUpload(db, new MemoryStorage(), testLogger, 404),
		).rejects.toBeInstanceOf(UploadNotFoundError);
		await expect(
			deleteUpload(db, new MemoryStorage(), testLogger, removed.id),
		).rejects.toBeInstanceOf(UploadNotFoundError);
	});

	it("refuses to delete a reserved upload", async () => {
		const userId = await seedUser(db);
		const reserved = await seedUpload(userId, { reserved: true });

		await expect(
			deleteUpload(db, new MemoryStorage(), testLogger, reserved.id),
		).rejects.toBeInstanceOf(UploadReservedError);
	});
});
