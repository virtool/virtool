import { populateClonedReference } from "@virtool/data/references/populate";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `clone_reference` carries the manifest the clone was frozen against.
 *
 * `createReference` writes it when the clone is requested: every OTU the source
 * reference held at that moment, mapped to the version it stood at. The clone is
 * built from that snapshot rather than from the source as it stands now, so
 * editing the source while the task runs cannot change what lands.
 */
const payload = z.object({
	manifest: z.record(z.string(), z.number().int().nonnegative()),
	ref_id: z.number().int().positive(),
	user_id: z.number().int().positive(),
});

/**
 * Fill a cloned reference with the OTUs of the reference it was cloned from.
 *
 * The port of Python's `CloneReferenceTask`, whose body is likewise one call.
 * Python reports a position within the step and so does this: the manifest gives
 * the OTU count up front, and a real reference is tens of thousands of them.
 * `report` takes a fraction where the data layer publishes percent.
 *
 * A failure takes the reference with it — the rollback inside
 * `populateClonedReference` deletes the half-built reference and its rows, so
 * the user sees it disappear rather than sitting there empty with no way to
 * finish it. That is Python's behaviour and both runners are live until the
 * cutover, so it is not this side's to soften.
 */
export const cloneReferenceTask = defineTask<typeof payload, TaskContext>({
	type: "clone_reference",
	payload,
	// Python's method name, which `BaseTask.run` writes to the column. Both
	// runners write `clone` for the same work until the cutover completes.
	steps: ["clone"],
	async run({ ctx, helpers, logger, payload, signal }) {
		await helpers.runStep("clone", async (report) => {
			await populateClonedReference(
				ctx.db,
				logger,
				{
					manifest: payload.manifest,
					referenceId: payload.ref_id,
					userId: payload.user_id,
				},
				async (percent) => {
					report(percent / 100);
				},
				signal,
			);
		});
	},
});
