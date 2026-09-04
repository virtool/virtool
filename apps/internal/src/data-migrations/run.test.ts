import {
	getDataMigration,
	listDataMigrationFindings,
} from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { defineAudit, defineBackfill } from "./define";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

const logger: Logger = createLogger({ name: "test", level: "silent" });

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(tasks);
});

/** Run `definition` with a signal that is never aborted. */
function run(definition: Parameters<typeof executeDataMigration>[1]) {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger,
			signal: new AbortController().signal,
		},
		definition,
	);
}

describe("audits", () => {
	it("pass when the body reports nothing", async () => {
		const finished = await run(
			defineAudit({
				key: "clean",
				migrationTag: "0024_fixture",
				kind: "audit",
				version: 1,
				description: "reports nothing",
				run: async () => {},
			}),
		);

		expect(finished).toMatchObject({
			status: "passed",
			attempts: 1,
			summary: { findings: 0, recorded: 0 },
			error: null,
		});
	});

	it("fail and keep what it found", async () => {
		const finished = await run(
			defineAudit({
				key: "dirty",
				migrationTag: "0024_fixture",
				kind: "audit",
				version: 1,
				description: "reports two problems",
				run: async ({ report }) => {
					report({ code: "orphan", subject: "user:1" });
					report({ code: "orphan", subject: "user:2" });
				},
			}),
		);

		expect(finished).toMatchObject({
			status: "failed",
			summary: { findings: 2, recorded: 2 },
		});

		expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
			{ code: "orphan", subject: "user:1" },
			{ code: "orphan", subject: "user:2" },
		]);
	});

	it("error with a redacted message, keeping what it found first", async () => {
		const finished = await run(
			defineAudit({
				key: "broken",
				migrationTag: "0024_fixture",
				kind: "audit",
				version: 1,
				description: "throws part way through",
				run: async ({ report }) => {
					report({ code: "orphan", subject: "user:1" });

					throw new Error(
						"lost postgres://virtool:hunter2@db:5432/virtool part way through",
					);
				},
			}),
		);

		expect(finished).toMatchObject({
			status: "errored",
			error:
				"lost postgres://virtool:[redacted]@db:5432/virtool part way through",
		});

		expect(await listDataMigrationFindings(db, finished.id)).toHaveLength(1);
	});

	it("count a retry and clear the previous attempt's findings", async () => {
		let clean = false;

		const audit = defineAudit({
			key: "remediated",
			migrationTag: "0024_fixture",
			kind: "audit",
			version: 1,
			description: "objects until the data is fixed",
			run: async ({ report }) => {
				if (!clean) {
					report({ code: "orphan", subject: "user:1" });
				}
			},
		});

		const first = await run(audit);

		expect(first.status).toBe("failed");

		clean = true;

		const second = await run(audit);

		expect(second).toMatchObject({ status: "passed", attempts: 2 });
		expect(await listDataMigrationFindings(db, second.id)).toHaveLength(0);
	});
});

/** Seed `count` task rows for a data migration to walk. */
async function seedTasks(count: number): Promise<void> {
	await db.insert(tasks).values(
		Array.from({ length: count }, () => ({
			type: "deliver_email",
			created_at: new Date(),
		})),
	);
}

/** How many seeded rows the migration below has not stamped yet. */
async function countUnstamped(): Promise<number> {
	return (await db.select().from(tasks).where(isNull(tasks.step))).length;
}

const Cursor = z.object({ afterId: z.number().int() });

/** Stamp task steps idempotently so a committed batch can safely be replayed. */
function stampSteps(options: {
	batchSize: number;
	onBatch?: () => void;
	version?: number;
	reportEvery?: number;
}) {
	return defineBackfill({
		key: "stamp_steps",
		migrationTag: "0024_fixture",
		kind: "backfill",
		version: options.version ?? 1,
		description: "stamps every task's step",
		batchSize: options.batchSize,
		cursor: Cursor,
		initialCursor: { afterId: 0 },
		runBatch: async ({ client, cursor, batchSize, report }) => {
			const rows = await client<{ id: number }[]>`
				select id from tasks where id > ${cursor.afterId} order by id limit ${batchSize}
			`;

			if (rows.length === 0) {
				return null;
			}

			for (const row of rows) {
				await client`update tasks set step = 'stamped' where id = ${row.id}`;

				if (
					options.reportEvery !== undefined &&
					row.id % options.reportEvery === 0
				) {
					report({ code: "unstampable", subject: `task:${row.id}` });
				}
			}

			options.onBatch?.();

			return {
				cursor: { afterId: rows[rows.length - 1]?.id ?? cursor.afterId },
				processed: rows.length,
			};
		},
	});
}

describe("data migrations", () => {
	it("walk every row in bounded batches and drop the resume point", async () => {
		await seedTasks(5);

		const finished = await run(stampSteps({ batchSize: 2 }));

		expect(finished).toMatchObject({
			status: "passed",
			progress: null,
			summary: { processed: 5, batches: 3, findings: 0 },
		});

		expect(await countUnstamped()).toBe(0);
	});

	it("keep the resume point when an attempt is interrupted", async () => {
		await seedTasks(5);

		const controller = new AbortController();

		const interrupted = await executeDataMigration(
			{ db, client: database.client, logger, signal: controller.signal },
			stampSteps({ batchSize: 2, onBatch: () => controller.abort() }),
		);

		expect(interrupted).toMatchObject({
			status: "errored",
			progress: { processed: 2, batches: 1 },
		});

		expect(await countUnstamped()).toBe(3);
	});

	it("resume from the recorded cursor rather than starting over", async () => {
		await seedTasks(5);

		const controller = new AbortController();

		await executeDataMigration(
			{ db, client: database.client, logger, signal: controller.signal },
			stampSteps({ batchSize: 2, onBatch: () => controller.abort() }),
		);

		const finished = await run(stampSteps({ batchSize: 2 }));

		expect(finished).toMatchObject({
			status: "passed",
			attempts: 2,
			// The two rows the first attempt committed are counted once, by the
			// attempt that committed them.
			summary: { processed: 5, batches: 3 },
		});

		expect(await countUnstamped()).toBe(0);
	});

	it("start over when the stored cursor no longer parses", async () => {
		await seedTasks(3);

		const row = await run(stampSteps({ batchSize: 2, onBatch: () => {} }));

		// Stand in for an implementation whose cursor shape moved between
		// versions: the row is there, and the new version cannot read it.
		await db
			.update(dataMigrations)
			.set({
				status: "errored",
				progress: { cursor: { after: "b" }, processed: 2, batches: 1 },
			})
			.where(eq(dataMigrations.id, row.id));

		const finished = await run(stampSteps({ batchSize: 2 }));

		expect(finished).toMatchObject({
			status: "passed",
			summary: { processed: 3, batches: 2 },
		});
	});

	it("stop at the first batch with findings without checkpointing it", async () => {
		await seedTasks(4);

		const finished = await run(stampSteps({ batchSize: 2, reportEvery: 1 }));

		expect(finished).toMatchObject({
			status: "failed",
			summary: { processed: 0, findings: 2 },
			progress: null,
		});

		expect(await countUnstamped()).toBe(2);
	});

	it("record a version of its own, leaving the earlier one standing", async () => {
		await seedTasks(2);

		await run(stampSteps({ batchSize: 2 }));
		await run(stampSteps({ batchSize: 2, version: 2 }));

		expect(await getDataMigration(db, "stamp_steps", 1)).toMatchObject({
			status: "passed",
			version: 1,
		});
		expect(await getDataMigration(db, "stamp_steps", 2)).toMatchObject({
			status: "passed",
			version: 2,
		});
	});
});

it("replays committed writes when the body errors before returning its checkpoint", async () => {
	await seedTasks(3);
	let interrupted = false;
	const failed = await run(
		stampSteps({
			batchSize: 2,
			onBatch() {
				if (!interrupted) {
					interrupted = true;
					throw new Error("interrupted after commit");
				}
			},
		}),
	);
	expect(failed).toMatchObject({ status: "errored", progress: null });
	expect(await countUnstamped()).toBe(1);
	const finished = await run(stampSteps({ batchSize: 2 }));
	expect(finished).toMatchObject({
		status: "passed",
		attempts: 2,
		summary: { processed: 3, batches: 2 },
	});
	expect(await countUnstamped()).toBe(0);
});

it("caps finding detail while counting every reported finding", async () => {
	const finished = await run(
		defineAudit({
			key: "many",
			migrationTag: "0024_fixture",
			version: 1,
			kind: "audit",
			description: "reports many findings",
			async run({ report }) {
				for (let index = 0; index < 5_001; index++) {
					report({ code: "invalid", subject: String(index) });
				}
			},
		}),
	);
	expect(finished).toMatchObject({
		status: "failed",
		summary: { findings: 5_001, recorded: 5_000 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toHaveLength(5_000);
});
