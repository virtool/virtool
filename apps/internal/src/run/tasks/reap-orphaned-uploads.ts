import { ORPHAN_AGE_SECONDS, reapUploads } from "@virtool/data/uploads/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `reap_orphaned_uploads` is spawned on a schedule and carries nothing.
 *
 * `z.object` strips unknown keys, so a row already written carrying one this
 * body does not read still runs.
 */
const payload = z.object({});

/**
 * Delete reserved uploads that no sample claims.
 *
 * The body is one call. The candidate count is known before the loop starts and
 * each iteration costs a round trip to object storage, so this reports a
 * position within the step rather than jumping 0 to 100. `report` takes a
 * fraction where the data layer publishes percent.
 */
export const reapOrphanedUploadsTask = defineTask<typeof payload, TaskContext>({
	type: "reap_orphaned_uploads",
	payload,
	// The name is written to the row's `step` column, which is what the UI shows
	// and what rows already written carry, so it is fixed.
	steps: ["reap"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("reap", async (report) => {
			const orphaned = await reapUploads(
				ctx.db,
				ctx.storage,
				logger,
				"orphaned",
				ORPHAN_AGE_SECONDS,
				async (percent) => {
					report(percent / 100);
				},
				signal,
			);

			if (orphaned.found > 0) {
				logger.info(
					{ found: orphaned.found, deleted: orphaned.deleted },
					"reaped orphaned reserved uploads",
				);
			}

			// Chunked uploads reserved but never finalized leave unfinished rows the
			// reserved sweep above does not match. Clear those in the same run.
			const stale = await reapUploads(
				ctx.db,
				ctx.storage,
				logger,
				"stale",
				ORPHAN_AGE_SECONDS,
				undefined,
				signal,
			);

			if (stale.found > 0) {
				logger.info(
					{ found: stale.found, deleted: stale.deleted },
					"reaped stale pending uploads",
				);
			}
		});
	},
});
