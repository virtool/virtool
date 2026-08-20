import { z } from "zod";

/**
 * A moment on a wire, as a `Date` on both sides of it.
 *
 * `z.coerce.date()` rather than `z.date()`: the value arriving over the jobs
 * API's wire is a string, and a `Date` passes through unchanged, so one schema
 * types both directions. `coerce` answers `Invalid Date` rather than throwing,
 * so without the refinement a malformed timestamp surfaces as `NaN` much later.
 *
 * Wire only — row content keeps the spelling its bytes carry, so `jobs.steps`
 * stores `started_at` as a string.
 */
export const Timestamp = z.coerce
	.date()
	.refine((value) => !Number.isNaN(value.getTime()), {
		message: "not a readable timestamp",
	});
