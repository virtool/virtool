import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import {
	legacyHistory,
	legacyHistoryDiff,
} from "@virtool/data/db/schema/history";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import type { ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { acquireOrThrow, readTaskRow, seedTaskRow } from "../testing/tasks";
import { cloneReferenceTask } from "./clone-reference";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let ctx: TaskContext;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(users);

	ctx = { db, storage: new MemoryStorage() };
});

async function seedReference(userId: number, name: string): Promise<number> {
	const [row] = await db
		.insert(legacyReferences)
		.values({
			name,
			description: "",
			organism: "virus",
			created_at: new Date("2021-06-01T00:00:00.000Z"),
			archived: false,
			restrict_source_types: false,
			source_types: [],
			user_id: userId,
		})
		.returning({ id: legacyReferences.id });

	if (row === undefined) {
		throw new Error("failed to seed a reference");
	}

	return row.id;
}

/**
 * Seed a source reference with `count` OTUs and the clone the task is to fill,
 * then claim the task the way the runner will.
 */
async function claimClone(
	count = 2,
	manifestOverride?: Record<string, number>,
) {
	const userId = await seedUser(db, { handle: "curator" });
	const sourceId = await seedReference(userId, "Source");
	const cloneId = await seedReference(userId, "Clone of Source");

	const manifest: Record<string, number> = {};

	for (let index = 0; index < count; index += 1) {
		const otuId = `src_otu_${index}`;
		const isolateId = `src_iso_${index}`;

		await db.insert(legacyOtus).values({
			id: otuId,
			data: {
				_id: otuId,
				name: `OTU ${index}`,
				abbreviation: "",
				lower_name: `otu ${index}`,
				isolates: [
					{
						id: isolateId,
						default: true,
						source_type: "isolate",
						source_name: isolateId,
					},
				],
				last_indexed_version: null,
				reference: { id: sourceId },
				schema: [],
				verified: true,
				version: 0,
			},
			name: `OTU ${index}`,
			abbreviation: "",
			reference_id: sourceId,
			verified: true,
			version: 0,
		});

		await db.insert(legacySequences).values({
			id: `src_seq_${index}`,
			data: {
				_id: `src_seq_${index}`,
				accession: `ACC${index}`,
				definition: "A definition",
				host: "",
				otu_id: otuId,
				isolate_id: isolateId,
				reference: { id: sourceId },
				segment: "",
				sequence: "ATGC",
			},
			otu_id: otuId,
			isolate_id: isolateId,
			segment: "",
			position: 0,
		});

		manifest[otuId] = 0;
	}

	const taskId = await seedTaskRow(db, cloneReferenceTask.type, {
		manifest: manifestOverride ?? manifest,
		ref_id: cloneId,
		user_id: userId,
	});

	return {
		task: await acquireOrThrow(db, cloneReferenceTask.type),
		cloneId,
		sourceId,
		taskId,
	};
}

function run(task: ClaimedTask, signal = new AbortController().signal) {
	return runTask({ db, def: cloneReferenceTask, task, ctx, logger, signal });
}

describe("cloneReferenceTask", () => {
	it("runs a claimed task through to complete and fills the reference", async () => {
		const { task, cloneId } = await claimClone();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "clone",
		});

		expect(
			await db
				.select({ id: legacyOtus.id })
				.from(legacyOtus)
				.where(eq(legacyOtus.reference_id, cloneId)),
		).toHaveLength(2);

		expect(
			await db
				.select({ id: legacyHistory.id })
				.from(legacyHistory)
				.where(eq(legacyHistory.reference_id, cloneId)),
		).toHaveLength(2);
	});

	// A reclaim re-runs a body from step zero, and the ids are minted fresh every
	// time. Without the clear the second attempt would double the reference.
	it("is idempotent across a re-run", async () => {
		const { task, cloneId } = await claimClone();

		expect(await run(task)).toEqual({ status: "completed" });

		await db
			.update(tasks)
			.set({ complete: false, runner_id: null, acquired_at: null })
			.where(eq(tasks.id, task.id));

		const second = await acquireOrThrow(db, cloneReferenceTask.type);

		expect(await run(second)).toEqual({ status: "completed" });

		expect(
			await db
				.select({ id: legacyOtus.id })
				.from(legacyOtus)
				.where(eq(legacyOtus.reference_id, cloneId)),
		).toHaveLength(2);
	});

	// The reference is gone rather than left half-built, which is what Python
	// does and what the two runners must agree on until the cutover.
	it("fails the task and deletes the reference when the manifest is unpatchable", async () => {
		const { task, cloneId } = await claimClone(1, { src_otu_missing: 0 });

		const outcome = await run(task);

		expect(outcome.status).toBe("failed");

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			step: "clone",
		});

		expect(
			await db
				.select({ id: legacyReferences.id })
				.from(legacyReferences)
				.where(eq(legacyReferences.id, cloneId)),
		).toHaveLength(0);
	});

	it("refuses a payload without the manifest the clone was frozen against", async () => {
		const userId = await seedUser(db, { handle: "curator" });
		const cloneId = await seedReference(userId, "Clone of Source");

		await seedTaskRow(db, cloneReferenceTask.type, {
			ref_id: cloneId,
			user_id: userId,
		});

		const task = await acquireOrThrow(db, cloneReferenceTask.type);

		expect((await run(task)).status).toBe("failed");
	});
});
