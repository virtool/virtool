import { z } from "zod";
import { NcbiUnreadableError } from "./errors";

/**
 * The `esearchresult` envelope, which is the only part of an ESearch response
 * this client reads.
 *
 * **`count` arrives as a string**, not a number — NCBI quotes every scalar in
 * its JSON. It is coerced here so paging arithmetic is done on numbers rather
 * than on `"872"`.
 */
const esearchSchema = z.object({
	esearchresult: z.object({
		count: z.coerce.number().int().nonnegative().default(0),
		idlist: z.array(z.string()).default([]),
	}),
});

/**
 * The refusal envelope NCBI sends **with a 200 status** in place of a result —
 * a bad database name, a malformed term.
 *
 * It has to be tested for before the result schema, which would otherwise
 * default the absent `count` and `idlist` and report a refusal as a search
 * that legitimately matched nothing.
 */
const esearchErrorSchema = z.object({
	esearchresult: z.object({ ERROR: z.string() }),
});

/** One page of an ESearch response. */
export type EsearchPage = {
	/** The total number of results the term matches, across every page. */
	count: number;
	/** The identifiers on this page. */
	ids: string[];
};

/** Parse an ESearch response body fetched with `retmode=json`. */
export function parseEsearch(text: string): EsearchPage {
	let document: unknown;

	try {
		document = JSON.parse(text);
	} catch (err) {
		throw new NcbiUnreadableError("NCBI returned unparseable JSON", {
			cause: err,
		});
	}

	const refusal = esearchErrorSchema.safeParse(document);

	if (refusal.success) {
		throw new NcbiUnreadableError(
			`NCBI refused the search: ${refusal.data.esearchresult.ERROR}`,
		);
	}

	const parsed = esearchSchema.safeParse(document);

	if (!parsed.success) {
		throw new NcbiUnreadableError(
			`NCBI returned an unexpected ESearch response: ${parsed.error.issues
				.map((issue) => issue.path.join("."))
				.join(", ")}`,
			{ cause: parsed.error },
		);
	}

	return {
		count: parsed.data.esearchresult.count,
		ids: parsed.data.esearchresult.idlist,
	};
}

/**
 * Build the `[SLEN]` term that bounds a search by sequence length.
 *
 * Returns an empty string when neither bound is set, which the caller drops
 * rather than joining it into the term.
 */
export function getSequenceLengthTerm(minLength = 0, maxLength = 0): string {
	if (minLength > 0 && maxLength > 0) {
		return `"${minLength}"[SLEN] : "${maxLength}"[SLEN]`;
	}

	if (minLength > 0) {
		return `"${minLength}"[SLEN] : "99999999"[SLEN]`;
	}

	if (maxLength > 0) {
		return `"0"[SLEN] : "${maxLength}"[SLEN]`;
	}

	return "";
}

/** The date fields an NCBI term may be bounded by. */
export type DateFilterType = "MDAT" | "PDAT";

/** NCBI's date format for a term filter. */
function formatDate(date: Date): string {
	return [
		String(date.getUTCFullYear()).padStart(4, "0"),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("/");
}

/**
 * Build the date term that bounds a search by modification or publication
 * date.
 *
 * An open end is filled with NCBI's own sentinels rather than left off: the
 * `[MDAT]` syntax is a range and has no one-sided form.
 */
export function getDateTerm(
	filterType: DateFilterType,
	startDate?: Date,
	endDate?: Date,
): string {
	if (startDate === undefined && endDate === undefined) {
		return "";
	}

	const start = startDate ? formatDate(startDate) : "0001/01/01";
	const end = endDate ? formatDate(endDate) : "3000/12/31";

	return `"${start}"[${filterType}] : "${end}"[${filterType}]`;
}
