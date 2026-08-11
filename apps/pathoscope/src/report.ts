/**
 * Reshaping the EM output into the per-reference report the analysis is built
 * from.
 *
 * The port of Python's `write_report`, minus the writing. Python also emitted a
 * `report.tsv` and uploaded it as the analysis's one retained file; nothing ever
 * read it back — every figure in it is in the `results` blob the same function
 * returns, and that blob is what the server formats and the SPA renders. So this
 * side writes no file at all, which is why `FinalizeAnalysisRequest.files` is
 * allowed to be empty and pathoscope is the reason it is.
 *
 * The EM core hands back eleven parallel arrays plus `refs`. They are gathered
 * into one entry per reference, ordered, and cut off at the first uninteresting
 * one.
 */

import type { PathoscopeEmResults } from "./pathoscopeCore";

/**
 * The decimal places every float in the report is rounded to.
 *
 * A storage choice, not a compatibility one. These are proportions and scores
 * out of a floating-point accumulation, so the digits past here are arithmetic
 * noise and keeping them only makes the JSONB blob larger. Ties at the tenth
 * place round however `toFixed` rounds them — Python's `round` breaks them to
 * even and this does not, and nothing depends on which.
 *
 * Applied **after** the cutoff, so rounding can never move a reference across
 * it.
 */
const PLACES = 10;

/**
 * The cutoff below which a reference is uninteresting, if it also has no
 * confident hits either way.
 */
const PI_CUTOFF = 0.01;

/** One reference's figures, before or after reassignment. */
export type ReportEntryLevel = {
	/** The proportion of reads from the entire sample matching this reference */
	pi: number;

	/** The best alignment score recorded against the reference */
	best: number;

	/** High-confidence hits */
	high: number;

	/** Low-confidence hits */
	low: number;

	/** The number of reads assigned to this reference */
	reads: number;
};

/** One reference's entry in the report. */
export type ReportEntry = {
	/** The reference sequence id */
	id: string;

	/** Figures after expectation maximization reassigned the multi-mapping reads */
	final: ReportEntryLevel;

	/** Figures from the initial assignment, before reassignment */
	initial: ReportEntryLevel;
};

/**
 * Gather the eleven parallel arrays into one entry per reference.
 *
 * The arrays are positional, so one short by a single element would shift every
 * figure after it onto the wrong reference and the report would still look
 * entirely plausible. Python zips them and lets a short array truncate the
 * result silently; here it is an error.
 *
 * @throws {Error} when any array is not the same length as `refs`.
 */
function gatherEntries(results: PathoscopeEmResults): ReportEntry[] {
	const {
		best_hit_final,
		best_hit_final_reads,
		best_hit_initial,
		best_hit_initial_reads,
		init_pi,
		level_1_final,
		level_1_initial,
		level_2_final,
		level_2_initial,
		pi,
		refs,
	} = results;

	for (const [name, values] of Object.entries(results)) {
		if (Array.isArray(values) && values.length !== refs.length) {
			throw new Error(
				`Expectation maximization returned ${values.length} ${name} values for ${refs.length} references`,
			);
		}
	}

	// Indexed rather than mapped over each array in turn: every read below is
	// bounds-checked by the loop above, so the non-null assertions the index would
	// otherwise need are gone.
	return refs.map((id, index) => ({
		id,
		final: {
			pi: at(pi, index),
			best: at(best_hit_final, index),
			high: at(level_1_final, index),
			low: at(level_2_final, index),
			reads: at(best_hit_final_reads, index),
		},
		initial: {
			pi: at(init_pi, index),
			best: at(best_hit_initial, index),
			high: at(level_1_initial, index),
			low: at(level_2_initial, index),
			reads: at(best_hit_initial_reads, index),
		},
	}));
}

function at(values: readonly number[], index: number): number {
	const value = values[index];

	// Unreachable: every array was measured against `refs` above. It throws
	// rather than defaulting because a zero here is a plausible-looking figure
	// and would be read as a real one.
	if (value === undefined) {
		throw new Error(`Expectation maximization returned no value at ${index}`);
	}

	return value;
}

/**
 * Order entries by share of reads, descending, breaking ties by reference id.
 *
 * The order is not cosmetic — it decides where the report is cut off, and so
 * which references reach the analysis at all.
 *
 * **The tie-break has to be on something stable.** `pi` ties routinely: a
 * segmented OTU's isolates share one, and so does every reference the EM run
 * assigned nothing to. Sorting on `pi` alone would leave those in the order the
 * EM core emitted them, which comes out of a Rust hash map and is not an order
 * at all — two runs over the same alignment could cut the report in different
 * places. The reference id is the only field here that is unique and stable, so
 * it settles it.
 */
function compareEntries(a: ReportEntry, b: ReportEntry): number {
	// Descending, so `b` before `a`.
	if (a.final.pi !== b.final.pi) {
		return b.final.pi - a.final.pi;
	}

	if (a.id === b.id) {
		return 0;
	}

	return a.id < b.id ? 1 : -1;
}

/**
 * Whether an entry is past the point the report stops at.
 *
 * A reference with a negligible share of the reads and no confident hits either
 * way carries no information.
 */
function isUninteresting({ final }: ReportEntry): boolean {
	return final.pi < PI_CUTOFF && final.high <= 0 && final.low <= 0;
}

function roundLevel(level: ReportEntryLevel): ReportEntryLevel {
	return {
		pi: round(level.pi),
		best: round(level.best),
		high: round(level.high),
		low: round(level.low),
		// The EM core types every read count as an `f64`, so it arrives fractional
		// and is truncated to a whole read.
		reads: Math.trunc(level.reads),
	};
}

function round(value: number): number {
	return Number(value.toFixed(PLACES));
}

/**
 * Build the report from an EM run's results.
 *
 * @returns the surviving references, most abundant first. An **ordered list**
 *   rather than a lookup: Python keyed a dict by sequence id, but nothing here
 *   addresses an entry by id — the order is the meaning.
 */
export function buildReport(results: PathoscopeEmResults): ReportEntry[] {
	const entries = gatherEntries(results).sort(compareEntries);

	// The index of the first uninteresting entry, not a filter. Everything from
	// there on is dropped however interesting it looks, because the sort has
	// already put the interesting ones first.
	const end = entries.findIndex(isUninteresting);

	return (end === -1 ? entries : entries.slice(0, end)).map((entry) => ({
		id: entry.id,
		final: roundLevel(entry.final),
		initial: roundLevel(entry.initial),
	}));
}
