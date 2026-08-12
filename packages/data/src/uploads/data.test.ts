import type { UploadType } from "@virtool/contracts";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db, PgClient } from "../db/pg";
import { sampleReads, sampleUploads } from "../db/schema/samples";
import { type UploadRow, uploads as uploadsTable } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { createEmitter } from "../events/emit";
import { testLogger } from "../test/logger";
import {
	createUpload,
	deleteUpload,
	findUploads,
	ORPHAN_AGE_SECONDS,
	reapOrphanedUploads,
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
	await db.delete(sampleReads);
	await db.delete(sampleUploads);
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

describe("reapOrphanedUploads", () => {
	// A minute-wide window rather than production's thirty days, which is what
	// the age being an argument buys.
	const WINDOW_SECONDS = 60;

	let notify: ReturnType<typeof vi.fn>;
	let storage: MemoryStorage;

	beforeEach(() => {
		// The fixture's emitter really NOTIFYs, so a published frame would be
		// invisible. Restored in `afterEach` for the rest of the file.
		notify = vi.fn().mockResolvedValue(undefined);
		createEmitter({
			client: { notify } as unknown as PgClient,
			logger: testLogger,
		});

		storage = new MemoryStorage();
	});

	afterEach(() => {
		createEmitter({ client: database.client, logger: testLogger });
	});

	function secondsAgoDate(seconds: number): Date {
		return new Date(Date.now() - seconds * 1000);
	}

	/** Seed an upload with an object behind it, and return the row and its key. */
	async function seedStored(
		userId: number,
		overrides: SeedOverrides = {},
	): Promise<UploadRow> {
		const row = await seedUpload(userId, {
			createdAt: secondsAgoDate(WINDOW_SECONDS * 2),
			reserved: true,
			...overrides,
		});

		if (row.storageKey) {
			await storage.write(row.storageKey, bodyOf("reads"));
		}

		return row;
	}

	function reap(
		onProgress?: (percent: number) => Promise<void>,
		backend: MemoryStorage = storage,
	) {
		return reapOrphanedUploads(
			db,
			backend,
			testLogger,
			WINDOW_SECONDS,
			onProgress,
		);
	}

	async function readRow(uploadId: number): Promise<UploadRow> {
		const [row] = await db
			.select()
			.from(uploadsTable)
			.where(eq(uploadsTable.id, uploadId));

		if (row === undefined) {
			throw new Error(`no upload row with id ${uploadId}`);
		}

		return row;
	}

	// Both runners sweep the same table until the cutover, so the shorter of the
	// two ages would be the real one.
	it("reaps at Python's thirty days", () => {
		expect(ORPHAN_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
	});

	it("releases, soft-deletes and removes the object of a genuine orphan", async () => {
		const userId = await seedUser(db);
		const orphan = await seedStored(userId);
		const key = orphan.storageKey ?? "";

		await expect(reap()).resolves.toEqual({ found: 1, deleted: 1 });

		const after = await readRow(orphan.id);

		expect(after.removed).toBe(true);
		expect(after.reserved).toBe(false);
		expect(after.removedAt).not.toBeNull();
		await expect(storage.size(key)).rejects.toThrow();
	});

	it("leaves a reservation younger than the window alone", async () => {
		const userId = await seedUser(db);
		const fresh = await seedStored(userId, { createdAt: secondsAgoDate(5) });

		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });
		expect((await readRow(fresh.id)).removed).toBe(false);
	});

	it("leaves an unreserved upload alone", async () => {
		const userId = await seedUser(db);
		const unreserved = await seedStored(userId, { reserved: false });

		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });
		expect((await readRow(unreserved.id)).removed).toBe(false);
	});

	it("leaves an already-removed upload alone", async () => {
		const userId = await seedUser(db);
		const removed = await seedStored(userId, { removed: true });
		const key = removed.storageKey ?? "";

		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });
		await expect(storage.size(key)).resolves.toBeGreaterThan(0);
	});

	it("leaves an upload a sample_reads row references alone", async () => {
		const userId = await seedUser(db);
		const linked = await seedStored(userId);

		await db.insert(sampleReads).values({
			sample: "sample-1",
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
			storage_key: "samples/sample-1/reads_1.fq.gz",
			upload: linked.id,
		});

		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });
		expect((await readRow(linked.id)).removed).toBe(false);
	});

	// A creation that died between the two rows has a `sample_uploads` row and no
	// `sample_reads`, which is the orphan this sweep exists for.
	it("reaps an upload only a sample_uploads row references", async () => {
		const userId = await seedUser(db);
		const orphan = await seedStored(userId);

		await db.insert(sampleUploads).values({
			sample: "sample-1",
			upload_id: orphan.id,
			index: 0,
		});

		await expect(reap()).resolves.toEqual({ found: 1, deleted: 1 });
		expect((await readRow(orphan.id)).removed).toBe(true);
	});

	it("splits uploads either side of the window boundary", async () => {
		const userId = await seedUser(db);
		const outside = await seedStored(userId, {
			createdAt: secondsAgoDate(WINDOW_SECONDS + 30),
		});
		const inside = await seedStored(userId, {
			createdAt: secondsAgoDate(WINDOW_SECONDS - 30),
		});

		await expect(reap()).resolves.toEqual({ found: 1, deleted: 1 });

		expect((await readRow(outside.id)).removed).toBe(true);
		expect((await readRow(inside.id)).removed).toBe(false);
	});

	// The regression the port exists for: Python's release-then-loop leaves the
	// rest `reserved = false, removed = false`, which no later sweep matches.
	it("soft-deletes an upload whose object refuses to delete, and continues", async () => {
		const userId = await seedUser(db);
		const first = await seedStored(userId);
		const failing = await seedStored(userId);
		const last = await seedStored(userId);

		const failingKey = failing.storageKey ?? "";
		const remove = storage.delete.bind(storage);

		vi.spyOn(storage, "delete").mockImplementation(async (key: string) => {
			if (key === failingKey) {
				throw new Error("bucket refused the key");
			}

			await remove(key);
		});

		await expect(reap()).resolves.toEqual({ found: 3, deleted: 3 });

		for (const id of [first.id, failing.id, last.id]) {
			const row = await readRow(id);

			expect(row.removed).toBe(true);
			expect(row.reserved).toBe(false);
		}

		// The row survives, so the key naming the leaked object is still recorded.
		expect((await readRow(failing.id)).storageKey).toBe(failingKey);
		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });
	});

	it("is idempotent across runs", async () => {
		const userId = await seedUser(db);
		const orphan = await seedStored(userId);

		await reap();
		const first = await readRow(orphan.id);

		await expect(reap()).resolves.toEqual({ found: 0, deleted: 0 });

		const second = await readRow(orphan.id);

		expect(second.removedAt).toEqual(first.removedAt);
		expect(second.removed).toBe(true);
	});

	it("reports no progress and returns zero when nothing is orphaned", async () => {
		const onProgress = vi.fn().mockResolvedValue(undefined);

		await expect(reap(onProgress)).resolves.toEqual({ found: 0, deleted: 0 });
		expect(onProgress).not.toHaveBeenCalled();
	});

	it("reports progress across the delete loop, ending at 100", async () => {
		const userId = await seedUser(db);

		for (let index = 0; index < 4; index++) {
			await seedStored(userId);
		}

		const reported: number[] = [];

		await reap(async (percent) => {
			reported.push(percent);
		});

		expect(reported).toEqual([25, 50, 75, 100]);
	});

	it("soft-deletes an upload with no storage_key without touching storage", async () => {
		const userId = await seedUser(db);
		const keyless = await seedStored(userId, { storageKey: null });

		const remove = vi.spyOn(storage, "delete");

		await expect(reap()).resolves.toEqual({ found: 1, deleted: 1 });

		expect(remove).not.toHaveBeenCalled();
		expect((await readRow(keyless.id)).removed).toBe(true);
	});

	it("publishes no uploads frame", async () => {
		const userId = await seedUser(db);
		await seedStored(userId);

		await expect(reap()).resolves.toEqual({ found: 1, deleted: 1 });
		expect(notify).not.toHaveBeenCalled();
	});
});
