import { deleteExpiredSessions } from "@virtool/data/auth/session";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `cleanup_sessions` carries nothing.
 */
const payload = z.object({});

/**
 * Delete expired session rows.
 *
 * It is idempotent as a reclaim requires: a re-run deletes whatever is expired
 * when it runs, which is nothing if the first attempt got there.
 *
 */
export const cleanupSessionsTask = defineTask<typeof payload, TaskContext>({
	type: "cleanup_sessions",
	payload,
	steps: ["cleanup_expired_sessions"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("cleanup_expired_sessions", async () => {
			const deleted = await deleteExpiredSessions(ctx.db, { signal });

			if (deleted > 0) {
				logger.info({ count: deleted }, "cleaned up expired sessions");
			}
		});
	},
});
