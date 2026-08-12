/**
 * `timeout_jobs` — fail every running job whose runner has stopped pinging.
 *
 * The body is one call to `timeoutStalledJobs` (`@virtool/data/jobs/data`)
 * inside one step. The rules governing the write itself — the single
 * conditional statement, the clocks it reads, and what a timed-out row may and
 * may not carry — are documented on that function, next to the SQL they
 * describe. What follows is the body's own.
 *
 * **The threshold is a constant, not configuration.** `JOB_TIMEOUT_SECONDS` is
 * five minutes and there is no `VT_` key behind it: how long a job may go
 * silent is fleet-wide application state, not a fact about the pod reading it,
 * and every sweep has to agree on which rows are stale. It is an argument with
 * a default rather than a value read inside, so a test can drive the sweep
 * without waiting five real minutes out.
 *
 * **That threshold is unrelated to the interval at which the spawner creates
 * the row.** One is how long a job may go silent, the other how often the sweep
 * runs. They are not two views of one interval and must never be collapsed into
 * a single constant.
 *
 * **It reports no progress.** The sweep is a single round trip and the count is
 * not known until it returns, so there is no position worth publishing and the
 * bar moves 0 → 100 on the framework's step entry and completion writes alone.
 *
 * **It is idempotent, as a reclaim requires.** The statement matches only rows
 * still running and still stale, so a body restarted from step zero is a no-op
 * against a sweep that already committed.
 *
 * **The run's signal is not forwarded**, because nothing here waits on anything
 * a caller could abandon. A drain arriving mid-sweep lets the statement and its
 * frames finish, which is what should happen: those jobs are failed, and a
 * frame withheld is a job page left showing one of them as running.
 */

import { timeoutStalledJobs } from "@virtool/data/jobs/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/** `timeout_jobs` is spawned on a schedule and carries nothing. */
const payload = z.object({});

/** Fail every running job whose runner has stopped pinging. */
export const timeoutJobsTask = defineTask<typeof payload, TaskContext>({
	type: "timeout_jobs",
	payload,
	steps: ["timeout_jobs"],
	async run({ ctx, helpers, logger }) {
		await helpers.runStep("timeout_jobs", async () => {
			const timedOut = await timeoutStalledJobs(ctx.db);

			if (timedOut.length > 0) {
				logger.info({ count: timedOut.length }, "timed out stalled jobs");
			}
		});
	},
});
