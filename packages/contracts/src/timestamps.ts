import { z } from "zod";

/**
 * A moment on a wire, as a `Date` on both sides of it.
 *
 * JSON has no date type, so the bytes are an ISO-8601 string either way —
 * `JSON.stringify` calls `Date.prototype.toJSON`, which is `toISOString`. The
 * SPA's boundary encodes it with seroval, which revives a `Date` as a `Date`.
 * What this buys is the type: a handler hands the `Date` it read out of
 * Postgres straight to its response, and the caller gets a `Date` back rather
 * than a string every reader would have to remember to parse.
 *
 * `z.coerce.date()` rather than `z.date()`, because the value arriving over the
 * jobs API's wire really is a string; `z.date()` would reject it. It passes a
 * `Date` through unchanged, so the same schema types both directions.
 *
 * The refinement is not decoration. `coerce` runs `new Date(value)`, which
 * answers `Invalid Date` rather than throwing for anything it cannot read — so
 * without it a malformed timestamp parses successfully and surfaces as `NaN`
 * somewhere much later.
 *
 * **This is the wire only**, and unqualified for the same reason `JobStep` and
 * `JobClaim` are: in this package the plain name is the wire shape and the
 * `Stored` prefix marks row content. Row content keeps whatever spelling its
 * bytes already carry — the `jobs.steps` JSONB array stores `started_at` as a
 * string, as does the `legacy_hmm_status` blob.
 */
export const Timestamp = z.coerce
	.date()
	.refine((value) => !Number.isNaN(value.getTime()), {
		message: "not a readable timestamp",
	});
