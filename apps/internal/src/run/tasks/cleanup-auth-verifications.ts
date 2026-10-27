import { deleteExpiredVerifications } from "@virtool/data/auth/verifications";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

const payload = z.object({});

/** Delete expired Better Auth verification rows. */
export const cleanupAuthVerificationsTask = defineTask<
	typeof payload,
	TaskContext
>({
	type: "cleanup_auth_verifications",
	payload,
	steps: ["cleanup_expired_verifications"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("cleanup_expired_verifications", async () => {
			const deleted = await deleteExpiredVerifications(ctx.db, { signal });

			if (deleted > 0) {
				logger.info({ count: deleted }, "cleaned up expired verifications");
			}
		});
	},
});
