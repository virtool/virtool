import {
	ORPHAN_AGE_SECONDS,
	reapOrphanedUploads,
} from "@virtool/data/uploads/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `reap_orphaned_uploads` is spawned on a schedule and carries nothing.
 *
 * `z.object` strips unknown keys, so a row Python wrote carrying one this side
 * does not read still runs.
 */
const payload = z.object({});

/**
 * Delete reserved uploads that no sample claims.
 *
 * The port of Python's `ReapOrphanedUploadsTask`, whose body is likewise one
 * call. Python jumps 0 to 100; the candidate count is known before the loop
 * starts and each iteration costs a round trip to object storage, so this
 * reports a position. `report` takes a fraction where the data layer publishes
 * percent.
 */
export const reapOrphanedUploadsTask = defineTask<typeof payload, TaskContext>({
	type: "reap_orphaned_uploads",
	payload,
	// Python's method name, which `BaseTask.run` writes to the column. Both
	// runners write `reap` for the same work until the cutover completes.
	steps: ["reap"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("reap", async (report) => {
			const { found, deleted } = await reapOrphanedUploads(
				ctx.db,
				ctx.storage,
				logger,
				ORPHAN_AGE_SECONDS,
				async (percent) => {
					report(percent / 100);
				},
				signal,
			);

			if (found > 0) {
				logger.info({ found, deleted }, "reaped orphaned reserved uploads");
			}
		});
	},
});
