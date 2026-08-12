import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { sampleReads, sampleUploads } from "@virtool/data/db/schema/samples";
import { tasks } from "@virtool/data/db/schema/tasks";
import { uploads } from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { ORPHAN_AGE_SECONDS } from "@virtool/data/uploads/data";
import { createLogger, type Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { claimTask, readTaskRow } from "../testing/tasks";
import { reapOrphanedUploadsTask } from "./reap-orphaned-uploads";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let ctx: TaskContext;
let userId: number;

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
	await db.delete(uploads);
	await db.delete(users);
	await db.delete(tasks);

	storage = new MemoryStorage();
	ctx = { db, storage };
	userId = await seedUser(db);
});

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

/**
 * Seed a reserved upload with an object behind it, aged past the body's own
 * {@link ORPHAN_AGE_SECONDS}. The window is only an argument at the data layer,
 * which `data.test.ts` drives directly.
 */
async function seedOrphan(index: number): Promise<{ id: number; key: string }> {
	const key = `uploads/orphan-${index}`;

	await storage.write(key, body(key));

	const [row] = await db
		.insert(uploads)
		.values({
			createdAt: new Date(Date.now() - (ORPHAN_AGE_SECONDS + 3600) * 1000),
			name: `reads-${index}.fq.gz`,
			nameOnDisk: `disk-${index}`,
			ready: true,
			removed: false,
			reserved: true,
			size: 10,
			storageKey: key,
			type: "reads",
			uploadedAt: new Date(),
			userId,
		})
		.returning({ id: uploads.id });

	if (row === undefined) {
		throw new Error("failed to seed an orphaned upload");
	}

	return { id: row.id, key };
}

async function readUpload(uploadId: number) {
	const [row] = await db.select().from(uploads).where(eq(uploads.id, uploadId));

	if (row === undefined) {
		throw new Error(`no upload row with id ${uploadId}`);
	}

	return row;
}

describe("reapOrphanedUploadsTask", () => {
	it("reaps every orphan and finishes the task", async () => {
		const first = await seedOrphan(0);
		const second = await seedOrphan(1);

		const task = await claimTask(db, reapOrphanedUploadsTask);

		const outcome = await runTask({
			db,
			def: reapOrphanedUploadsTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "reap",
		});

		for (const orphan of [first, second]) {
			expect(await readUpload(orphan.id)).toMatchObject({
				removed: true,
				reserved: false,
			});
			await expect(storage.size(orphan.key)).rejects.toThrow();
		}
	});

	it("completes with nothing to reap", async () => {
		const task = await claimTask(db, reapOrphanedUploadsTask);

		const outcome = await runTask({
			db,
			def: reapOrphanedUploadsTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
		});
	});

	// A refused delete leaks bytes but must not fail the sweep, and the soft
	// delete keeps the key naming them.
	it("completes when storage refuses a delete", async () => {
		const orphan = await seedOrphan(0);

		const refusing: StorageBackend = {
			read: (key) => storage.read(key),
			write: (key, data) => storage.write(key, data),
			list: (prefix) => storage.list(prefix),
			size: (key) => storage.size(key),
			delete: async () => {
				throw new Error("bucket refused the delete");
			},
		};

		const outcome = await runTask({
			db,
			def: reapOrphanedUploadsTask,
			task: await claimTask(db, reapOrphanedUploadsTask),
			ctx: { db, storage: refusing },
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });

		expect(await readUpload(orphan.id)).toMatchObject({
			removed: true,
			reserved: false,
			storageKey: orphan.key,
		});
	});

	// `runTask` awaits the body rather than racing it, so a sweep that ignored the
	// signal would hold the drain open and write on past the claim's release.
	it("stops sweeping when the run is aborted", async () => {
		const first = await seedOrphan(0);
		const second = await seedOrphan(1);

		const controller = new AbortController();

		// Aborts as the first object goes, so the check between iterations is what
		// stops the sweep. Aborting up front would never reach the body at all.
		const abortingOnDelete: StorageBackend = {
			read: (key) => storage.read(key),
			write: (key, data) => storage.write(key, data),
			list: (prefix) => storage.list(prefix),
			size: (key) => storage.size(key),
			delete: async (key) => {
				await storage.delete(key);
				controller.abort();
			},
		};

		const outcome = await runTask({
			db,
			def: reapOrphanedUploadsTask,
			task: await claimTask(db, reapOrphanedUploadsTask),
			ctx: { db, storage: abortingOnDelete },
			logger,
			signal: controller.signal,
		});

		expect(outcome).toEqual({ status: "aborted" });

		expect(await readUpload(first.id)).toMatchObject({ removed: true });
		expect(await readUpload(second.id)).toMatchObject({
			removed: false,
			reserved: true,
		});
		await expect(storage.size(second.key)).resolves.toBeGreaterThan(0);
	});
});
