import { deleteExpiredSetupState } from "@virtool/data/auth/setup";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `cleanup_setup_state` carries nothing.
 */
const payload = z.object({});

/**
 * Delete expired setup tokens and restricted setup sessions.
 *
 * Kept apart from `cleanup_sessions` rather than folded into it. The two sweep
 * different tables on different lifetimes, and a single task that failed
 * part-way would leave whichever half ran second permanently unswept while
 * reporting the same one failure.
 *
 * It is idempotent as a reclaim requires: a re-run deletes whatever is expired
 * when it runs, which is nothing if the first attempt got there.
 */
export const cleanupSetupStateTask = defineTask<typeof payload, TaskContext>({
	type: "cleanup_setup_state",
	payload,
	steps: ["cleanup_expired_setup_state"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("cleanup_expired_setup_state", async () => {
			const { tokens, sessions } = await deleteExpiredSetupState(ctx.db, {
				signal,
			});

			if (tokens > 0 || sessions > 0) {
				logger.info({ sessions, tokens }, "cleaned up expired setup state");
			}
		});
	},
});
