// The display metrics a pathoscope result carries, derived from the raw
// per-position alignments.
//
// These are computed here, before `transformCoverageToCoordinates` reduces an
// alignment to the points a chart draws. Deriving them from the reduced polyline
// instead — which is what the client used to do — reads a lossy reconstruction:
// the reduction keeps one point per column, and re-expanding carries the
// previous depth forward across each gap, so a dropped return-to-zero overstates
// coverage and depth.

import { median } from "es-toolkit";

/**
 * A hit's raw per-position read depths, normalised to the length of the
 * reference sequence.
 *
 * A hit that recorded no alignment has no depth anywhere, which reads as a
 * zero-filled genome rather than an absent one — the position is still part of
 * the isolate whose coverage is being measured. A stored alignment that
 * disagrees with the sequence it names is truncated or zero-padded to fit, so
 * the depths of an isolate's sequences concatenate to its stated length.
 */
export function toDepths(align: unknown, length: number): number[] {
	if (!Array.isArray(align)) {
		return new Array<number>(length).fill(0);
	}

	return Array.from({ length }, (_, position) => {
		const depth = align[position];

		return typeof depth === "number" ? depth : 0;
	});
}

/**
 * The median read depth across `depths`, rounded to a whole number of reads.
 *
 * Depth is displayed as a read count, so the half-value an even-length list
 * produces is rounded away here. The CSV and XLSX exports report the unrounded
 * per-sequence figure, matching Python. An empty list has no depth, which reads
 * as zero rather than `NaN`.
 */
export function medianDepth(depths: number[]): number {
	return depths.length === 0 ? 0 : Math.round(median(depths));
}

/** The proportion of positions in `depths` that carry at least one read. */
export function coverageOf(depths: number[]): number {
	if (depths.length === 0) {
		return 0;
	}

	return depths.filter((depth) => depth > 0).length / depths.length;
}

/** The greatest depth in `depths`, or zero when there are none. */
export function maxDepthOf(depths: number[]): number {
	let peak = 0;

	for (const depth of depths) {
		if (depth > peak) {
			peak = depth;
		}
	}

	return peak;
}

/**
 * Merge per-isolate depth arrays into one curve representing the whole OTU.
 *
 * Each position takes the greatest depth any isolate recorded there. Isolates
 * are of different lengths, so a position past the end of a shorter one is not
 * counted as zero — it contributes nothing.
 */
export function mergeDepths(depths: number[][]): number[] {
	const length = depths.reduce(
		(longest, isolate) => Math.max(longest, isolate.length),
		0,
	);

	return Array.from({ length }, (_, position) => {
		let peak = 0;

		for (const isolate of depths) {
			const depth = isolate[position];

			if (depth !== undefined && depth > peak) {
				peak = depth;
			}
		}

		return peak;
	});
}
