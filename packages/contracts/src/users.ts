import { z } from "zod";

/** A user reduced to the fields shown alongside another resource. */
export const UserNested = z.object({
	/** The unique identifier */
	id: z.number().int(),

	/** The user's handle or username */
	handle: z.string(),
});

export type UserNested = z.infer<typeof UserNested>;
