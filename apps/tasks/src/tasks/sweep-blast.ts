/**
 * `sweep_blast` — advance every outstanding NuVs BLAST search against NCBI.
 *
 * The body is one call to `sweepBlasts` (`@virtool/data/blast/data`) inside one
 * step. Everything about which rows are touched, how they are spaced out, and
 * what NCBI is asked lives on that function and on `@virtool/data/blast/ncbi`,
 * next to the requests they describe. What follows is the body's own.
 *
 * **It is the only task on a thirty-second period**, which is what makes a
 * user's BLAST panel move at all — the row it advances is one somebody is
 * sitting in front of. Every other periodic task runs at ten minutes or longer.
 *
 * **It reports no progress.** The sweep does not know how many rows it will
 * touch until it has read them, and the rows it does touch each take a single
 * round trip, so there is no position worth publishing and the bar moves
 * 0 → 100 on the framework's step entry and completion writes alone. What a
 * user watches instead is the BLAST panel, which the sweep's own `analyses`
 * frames drive.
 *
 * **It is idempotent, as a reclaim requires.** Every write is guarded — a
 * submission on the row still having no RID, a result on the row still carrying
 * the RID that was checked — so a body restarted from step zero writes nothing
 * a committed sweep already wrote. Two sweeps running at once, which a
 * duplicate spawn would produce, would submit the same sequence twice and
 * discard the loser's RID rather than corrupt the row.
 *
 * **The run's signal is forwarded into every NCBI request.** Nothing interrupts
 * a body on its own — `runTask` awaits it — so a sweep left to run its own
 * deadlines out holds the drain open behind it, and can reach a write on behalf
 * of a runner that has already released the claim. The `nuvs_blast` row is not
 * fenced on `runner_id`; only the `tasks` row is.
 */

import { sweepBlasts } from "@virtool/data/blast/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/** `sweep_blast` is spawned on a schedule and carries nothing. */
const payload = z.object({});

/** Advance every outstanding NuVs BLAST search against NCBI. */
export const sweepBlastTask = defineTask<typeof payload, TaskContext>({
	type: "sweep_blast",
	payload,
	// Python names its step after the bound method it runs, `BaseTask.run`
	// writing `func.__name__` into the column. Both runners write `sweep` for the
	// same work until the cutover completes.
	steps: ["sweep"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("sweep", async () => {
			await sweepBlasts(ctx.db, logger, signal);
		});
	},
});
