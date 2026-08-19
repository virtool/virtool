import { generateTaskIndex } from "@virtool/data/indexes/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `create_index` carries the build it is to finish.
 *
 * The id is an integer, and the schema refuses the stringified form rather than
 * coercing it: `createIndex` writes `{ index_id: index.id }`, so nothing
 * produces one.
 */
const payload = z.object({ index_id: z.number().int().positive() });

/**
 * Finish a reference index build.
 *
 * The body is one call. Everything this runs is `generateTaskIndex`: patch
 * every OTU in the manifest, stream the gzipped artifact to object storage,
 * register the file, stamp `last_indexed_version` and flip `ready`.
 *
 * It is idempotent as a reclaim requires, in two layers. A re-run that finds
 * the build already ready returns without writing anything rather than
 * throwing, which would fail the task and show an error against an index that
 * is fine. A re-run of a build that did *not* finish redoes the whole thing:
 * the artifact is rewritten under a fresh key and the `index_files` upsert
 * repoints the row at it, with the object it replaced deleted after the commit.
 *
 * It takes no `signal`. There is nothing here to forward one into — the storage
 * write, the patch reads and the transaction take none — so an abort arrives as
 * a rejection from whatever was in flight, or the run finishes. The chunk loop
 * yields the event loop so the heartbeat stays live while it works.
 */
export const createIndexTask = defineTask<typeof payload, TaskContext>({
	type: "create_index",
	payload,
	// The name is written to the row's `step` column, which is what the UI shows
	// and what rows already written carry, so it is fixed.
	steps: ["build_index"],
	async run({ ctx, helpers, logger, payload }) {
		await helpers.runStep("build_index", async (report) => {
			// This is the longest-running of the ten bodies — a reference clone's
			// worth of OTUs — and the chunked patch loop makes its position
			// knowable, so it reports a position rather than jumping 0 to 100.
			// `report` takes a fraction where the data layer publishes percent.
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
