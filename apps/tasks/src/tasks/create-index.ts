import { generateTaskIndex } from "@virtool/data/indexes/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `create_index` carries the build it is to finish.
 *
 * The id is an integer. Python's `generate_task_index` also accepts the
 * stringified legacy form, for a task enqueued before the integer-id cutover,
 * but nothing produces one: `createIndex` writes `{ index_id: index.id }` and
 * the only `CreateIndexTask` construction left on Python's side is in
 * `virtool/fake`.
 */
const payload = z.object({ index_id: z.number().int().positive() });

/**
 * Finish a reference index build.
 *
 * The port of Python's `CreateIndexTask`, whose body is one call. Everything
 * this runs is `generateTaskIndex`: patch every OTU in the manifest, stream the
 * gzipped artifact to object storage, register the file, stamp
 * `last_indexed_version` and flip `ready`.
 *
 * It is idempotent as a reclaim requires, in two layers. A re-run that finds the
 * build already ready returns without writing anything — where Python raises,
 * which would fail the task and show an error against an index that is fine. A
 * re-run of a build that did *not* finish redoes the whole thing: the artifact
 * is rewritten under a fresh key and the `index_files` upsert repoints the row
 * at it, with the object it replaced deleted after the commit.
 *
 * It takes no `signal`. There is nothing here to forward one into — the storage
 * write, the patch reads and the transaction take none — so an abort arrives as
 * a rejection from whatever was in flight, or the run finishes. The chunk loop
 * yields the event loop so the heartbeat stays live while it works.
 */
export const createIndexTask = defineTask<typeof payload, TaskContext>({
	type: "create_index",
	payload,
	// Python names its step after the bound method it runs, `BaseTask.run`
	// writing `func.__name__` into the column. Both runners write `build_index`
	// for the same work until the cutover completes.
	steps: ["build_index"],
	async run({ ctx, helpers, logger, payload }) {
		await helpers.runStep("build_index", async (report) => {
			// Python's task takes no progress handler and jumps 0 to 100. This is the
			// longest-running of the ten bodies — a reference clone's worth of OTUs —
			// and the chunked patch loop makes its position knowable, so it is
			// reported. `report` takes a fraction where the data layer publishes
			// percent.
			await generateTaskIndex(
				ctx.db,
				ctx.storage,
				logger,
				payload.index_id,
				async (percent) => {
					report(percent / 100);
				},
			);
		});
	},
});
