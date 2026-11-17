import { createServerFn } from "@tanstack/react-start";
import { Timestamp } from "@virtool/contracts";
import { markChangelogSeen } from "@virtool/data/users/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";

// The date is not checked against any list of posts. The client reads posts
// from the website, and a pod of an older release must still accept the date
// of a post that a newer release shipped.
const markChangelogSeenSchema = z.object({
	newestPostDate: Timestamp.refine((date) => date.getTime() <= Date.now(), {
		message: "The date must not be in the future.",
	}),
});

/**
 * Move the signed-in user's changelog watermark to the date of the newest post
 * that the client showed them. The watermark only moves forward.
 */
export const markChangelogSeenFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(markChangelogSeenSchema)
	.handler(async ({ context, data }) => {
		await markChangelogSeen(db, context.principal.userId, data.newestPostDate);

		return null;
	});
