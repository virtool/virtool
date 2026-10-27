import { recreateHmmAnnotations } from "@virtool/data/hmm/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/** `recreate_hmm_annotations` is spawned on a schedule and carries nothing. */
const payload = z.object({});

/**
 * Write the HMM annotations blob again when it is missing.
 *
 * Nuvs fails before its first step when the blob is missing, and no request
 * can write it. This task is the recovery path, so its interval sets how long
 * Nuvs analyses fail after the blob goes missing.
 *
 * Idempotent: a second run finds the blob and writes nothing.
 */
export const recreateHmmAnnotationsTask = defineTask<
	typeof payload,
	TaskContext
>({
	type: "recreate_hmm_annotations",
	payload,
	// The name is written to the row's `step` column, which is what the UI shows
	// and what rows already written carry, so it is fixed.
	steps: ["recreate"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("recreate", async () => {
			if (await recreateHmmAnnotations(ctx.db, ctx.storage, signal)) {
				logger.info("recreated the missing hmm annotations blob");
			}
		});
	},
});
