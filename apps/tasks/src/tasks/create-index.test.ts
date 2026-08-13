import { gunzipSync } from "node:zlib";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { legacyHistory } from "@virtool/data/db/schema/history";
import { indexes, indexFiles } from "@virtool/data/db/schema/indexes";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import { legacyReferences } from "@virtool/data/db/schema/references";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedReference } from "@virtool/data/indexes/test/fixtures";
import type { ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { MemoryStorage, type StorageBackend } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { acquireOrThrow, readTaskRow, seedTaskRow } from "../testing/tasks";
import { createIndexTask } from "./create-index";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let storage: StorageBackend;
let ctx: TaskContext;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(indexFiles);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(indexes);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(users);

	storage = new MemoryStorage();
	ctx = { db, storage };
});

let handleCounter = 0;

/**
 * Seed a reference with `count` OTUs and a pending task-backed build, then claim
 * the task the way the runner will.
 */
async function claimBuild(count = 2): Promise<{
	task: ClaimedTask;
	indexId: number;
	referenceId: number;
}> {
	handleCounter += 1;

	const userId = await seedUser(db, { handle: `builder${handleCounter}` });
	const referenceId = await seedReference(db, userId);

	const otus = Array.from({ length: count }, (_, index) => ({
		id: `otu${String(index).padStart(5, "0")}`,
		version: 1,
	}));

	if (otus.length > 0) {
		await db.insert(legacyOtus).values(
			otus.map(({ id, version }) => ({
				id,
				data: {
					_id: id,
					abbreviation: "",
					name: `OTU ${id}`,
					isolates: [
						{
							id: `iso_${id}`,
							default: true,
							source_type: "isolate",
							source_name: id.toUpperCase(),
						},
					],
					schema: [],
					taxid: null,
					version,
				},
				name: `OTU ${id}`,
				abbreviation: "",
				reference_id: referenceId,
				verified: true,
				version,
			})),
		);

		// Sequences are their own table and are merged into the isolate they name.
		// Without them every isolate is empty, which the snapshot writer refuses.
		await db.insert(legacySequences).values(
			otus.map(({ id }) => ({
				id: `seq_${id}`,
				otu_id: id,
				isolate_id: `iso_${id}`,
				position: 0,
				segment: null,
				data: {
					_id: `seq_${id}`,
					accession: `NC_${id}`,
					definition: `OTU ${id} complete genome`,
					host: null,
					isolate_id: `iso_${id}`,
					segment: null,
					sequence: "ACGTACGTAC",
				},
			})),
		);
	}

	const manifest: Record<string, number> = {};

	for (const otu of otus) {
		manifest[otu.id] = otu.version;
	}

	const taskId = await seedTaskRow(db, createIndexTask.type);

	const [indexRow] = await db
		.insert(indexes)
		.values({
			created_at: new Date(),
			manifest,
			ready: false,
			reference_id: referenceId,
			storage_key: `5f9a${handleCounter}legacymongoslug`,
			user_id: userId,
			version: 0,
			task_id: taskId,
		})
		.returning({ id: indexes.id });

	const indexId = indexRow?.id as number;

	await db
		.update(tasks)
		.set({ context: { index_id: indexId } })
		.where(eq(tasks.id, taskId));

	const claimed = await acquireOrThrow(db, createIndexTask.type);

	return { task: claimed, indexId, referenceId };
}

function run(task: ClaimedTask, signal = new AbortController().signal) {
	return runTask({ db, def: createIndexTask, task, ctx, logger, signal });
}

describe("createIndexTask", () => {
	it("runs a claimed task through to complete and publishes the artifact", async () => {
		const { task, indexId } = await claimBuild();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "build_index",
		});

		const [index] = await db
			.select({ ready: indexes.ready })
			.from(indexes)
			.where(eq(indexes.id, indexId));

		expect(index?.ready).toBe(true);

		const files = await db
			.select()
			.from(indexFiles)
			.where(eq(indexFiles.index_id, indexId))
			.orderBy(indexFiles.name);

		expect(files.map((file) => file.name)).toEqual([
			"reference-snapshot.v1.sqlite",
			"reference-v2.json.gz",
		]);

		const file = files.find((row) => row.name === "reference-v2.json.gz");

		const parts: Uint8Array[] = [];

		for await (const part of storage.read(file?.storage_key ?? "")) {
			parts.push(part);
		}

		const artifact = JSON.parse(
			gunzipSync(Buffer.concat(parts)).toString(),
		) as { otus: unknown[] };

		expect(artifact.otus).toHaveLength(2);
	});

	// A reclaim re-runs a body from step zero, and the first attempt may already
	// have committed. The second must leave what the first left rather than
	// failing the task over an index that is perfectly fine.
	it("is idempotent across a re-run", async () => {
		const { task, indexId } = await claimBuild();

		expect(await run(task)).toEqual({ status: "completed" });

		const afterFirst = await db
			.select()
			.from(indexFiles)
			.where(eq(indexFiles.index_id, indexId))
			.orderBy(indexFiles.name);

		// Claiming again needs the row back in a claimable state; the build itself
		// stays ready, which is the condition under test.
		await db
			.update(tasks)
			.set({ complete: false, runner_id: null, acquired_at: null })
			.where(eq(tasks.id, task.id));

		const second = await acquireOrThrow(db, createIndexTask.type);

		expect(await run(second)).toEqual({ status: "completed" });

		const rows = await db
			.select()
			.from(indexFiles)
			.where(eq(indexFiles.index_id, indexId))
			.orderBy(indexFiles.name);

		expect(rows).toEqual(afterFirst);
	});

	// The payload is parsed before any handler code runs, so a row carrying
	// something else fails the task rather than reaching the data layer.
	it("fails the task when the payload does not name an index", async () => {
		const { task } = await claimBuild();

		await db
			.update(tasks)
			.set({ context: { index_id: "abc" } })
			.where(eq(tasks.id, task.id));

		const reclaimed = { ...task, context: { index_id: "abc" } };

		const outcome = await run(reclaimed);

		expect(outcome.status).toBe("failed");
		expect(await readTaskRow(db, task.id)).toMatchObject({ complete: true });
	});

	// Nothing is registered and the build stays unfinished, so a rebuild can
	// replace it. The half-written object is the orphan sweep's.
	it("fails the task and leaves the build unfinished when the manifest is corrupt", async () => {
		const { task, indexId } = await claimBuild();

		await db
			.update(indexes)
			.set({ manifest: { otughost: 3 } })
			.where(eq(indexes.id, indexId));

		const outcome = await run(task);

		expect(outcome).toMatchObject({ status: "failed" });
		expect(outcome).toMatchObject({
			error: expect.stringContaining("IndexManifestError"),
		});

		const [index] = await db
			.select({ ready: indexes.ready })
			.from(indexes)
			.where(eq(indexes.id, indexId));

		expect(index?.ready).toBe(false);
		expect(
			await db
				.select()
				.from(indexFiles)
				.where(eq(indexFiles.index_id, indexId)),
		).toEqual([]);
	});
});
