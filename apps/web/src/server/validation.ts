import { z } from "zod";

/**
 * A row id. Every id the server accepts is a Postgres serial primary key, so
 * one definition covers them all — validators name the field
 * (`referenceId: rowIdSchema`) and reuse this for the value.
 */
export const rowIdSchema = z.number().int().positive();

/** The page number a paginated server function accepts. */
export const pageSchema = z.number().int().positive().default(1);

/**
 * The page size a paginated server function accepts, capped so a caller cannot
 * ask for an unbounded page.
 */
export const perPageSchema = z.number().int().positive().max(100).default(25);

/**
 * A calendar date in `yyyy-MM-dd` form, as a date filter carries it in the URL.
 *
 * The value names a day, not an instant: the caller decides which timezone's
 * midnight it resolves to.
 */
export const calendarDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a yyyy-MM-dd date.")
	// The pattern admits days that no month has, and `Date` rolls those forward
	// rather than rejecting them — `2026-02-31` parses as March 3rd. Formatting
	// the parsed instant back and comparing is what catches them.
	.refine((value) => {
		const parsed = new Date(`${value}T00:00:00.000Z`);

		return (
			!Number.isNaN(parsed.getTime()) &&
			parsed.toISOString().startsWith(`${value}T`)
		);
	}, "Expected a real calendar date.");
