import { z } from "zod";

/** A background task with live progress. */
export const TaskSchema = z.object({
	complete: z.boolean(),
	createdAt: z.coerce.date(),
	error: z.string().nullable(),
	id: z.number().int(),
	progress: z.number().int(),
	step: z.string(),
	type: z.string(),
});

/** Wire-shape task returned by the task server function before validation. */
export type ServerTask = z.input<typeof TaskSchema>;

/** A background task with live progress. */
export type Task = z.output<typeof TaskSchema>;
