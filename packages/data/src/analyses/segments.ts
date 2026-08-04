// How a detected OTU's sequences are matched up across its isolates, so the
// overview can draw one curve per genome segment instead of one curve per
// isolate laid end to end.
//
// Two keys, in order of preference. A sequence naming a schema segment is
// matched by that name, which is unambiguous. One naming none is matched by
// length: the isolates' sequences are binned, and a sequence joins the bin its
// length falls in.
//
// The bin count is not a tuning constant. It is the largest number of sequences
// any single isolate carries, which the data already states — so an OTU whose
// isolates hold one sequence each has exactly one bin however far their lengths
// diverge. That is what stops a reference's partial and truncated sequences from
// being drawn as segments of their own.

/** A sequence's measured depths, with what identifies the segment it fills. */
export type SegmentedSequence = {
	/** The per-position read depths, normalised to the sequence's length */
	depths: number[];

	/** The length of the reference sequence in nucleotides */
	length: number;

	/** The schema segment the sequence names, or null when it names none */
	segment: string | null;
};

/** What one isolate contributed to a segment. */
export type SegmentContribution<T> = {
	/** The isolate's position in the list the group was built from */
	index: number;

	/** The sequences that isolate carried for this segment */
	sequences: T[];
};

/** One genome segment, and what each isolate carrying it contributed. */
export type SegmentGroup<T> = {
	/**
	 * The longest sequence the OTU declares for this segment, or zero when the
	 * segment was inferred by length.
	 *
	 * It is the width a segment nothing mapped to is drawn at, since it has no
	 * merged curve to take a length from.
	 */
	declaredLength: number;

	/** The isolates that carried this segment. One that did not is absent. */
	isolates: SegmentContribution<T>[];

	/**
	 * The key a sequence is matched to this segment by.
	 *
	 * Named and length-inferred segments key into separate spaces, so an OTU
	 * declaring a segment literally named `0` cannot collide with the first bin.
	 */
	key: string;

	/** The schema segment name, or null when the segment was inferred by length */
	name: string | null;
};

/** The segment names an OTU document's schema declares, in schema order. */
export function readSchemaNames(document: Record<string, unknown>): string[] {
	const schema = document.schema;

	if (!Array.isArray(schema)) {
		return [];
	}

	const names: string[] = [];

	for (const entry of schema) {
		const name = (entry as { name?: unknown } | null)?.name;

		if (typeof name === "string" && name !== "") {
			names.push(name);
		}
	}

	return names;
}

// A sequence's rank in the schema. An unassigned one, and one naming a segment
// the schema at this version does not declare, sort after every declared
// segment.
function segmentIndex(segment: string | null, schemaNames: string[]): number {
	if (segment === null) {
		return schemaNames.length;
	}

	const index = schemaNames.indexOf(segment);

	return index === -1 ? schemaNames.length : index;
}

/**
 * Order sequences by schema segment, longest first within a rank.
 *
 * `sortSequencesBySegment` in `@otus/utils` is the original, and the OTU viewer
 * lays sequences out by this rule — the analysis view now agrees with it. That
 * one is client code, so the rule is spelled again here rather than imported. It
 * leaves its trailing unassigned sequences in insertion order where this breaks
 * the tie by length.
 */
export function compareBySegment<
	T extends { length: number; segment: string | null },
>(a: T, b: T, schemaNames: string[]): number {
	const rankA = segmentIndex(a.segment, schemaNames);
	const rankB = segmentIndex(b.segment, schemaNames);

	if (rankA !== rankB) {
		return rankA - rankB;
	}

	return b.length - a.length;
}

/**
 * The depths each isolate contributed to a segment, ready to merge.
 *
 * An isolate that carried more than one sequence for the same segment
 * contributes them concatenated, which is the shape the isolate charts already
 * draw a multi-sequence isolate in. Nothing prevents the case:
 * `legacy_sequences.segment` has no unique index and `checkSegment` only verifies
 * a name is declared, not that it is unclaimed, and two sequences of
 * near-identical length fall in one bin.
 */
export function segmentDepths<T extends SegmentedSequence>(
	group: SegmentGroup<T>,
): number[][] {
	return group.isolates.map((entry) =>
		entry.sequences.flatMap((sequence) => sequence.depths),
	);
}

// Every isolate holding a sequence this segment matches. One holding none is
// absent rather than contributing zeroes, so the segment is merged across only
// the isolates that carried it.
function collect<T extends SegmentedSequence>(
	isolates: T[][],
	matches: (sequence: T) => boolean,
): SegmentContribution<T>[] {
	return isolates
		.map((sequences, index) => ({
			index,
			sequences: sequences.filter(matches),
		}))
		.filter((entry) => entry.sequences.length > 0);
}

function longestOf<T extends SegmentedSequence>(
	isolates: SegmentContribution<T>[],
): number {
	return isolates.reduce(
		(longest, entry) =>
			Math.max(
				longest,
				entry.sequences.reduce((sum, sequence) => sum + sequence.length, 0),
			),
		0,
	);
}

/**
 * The lengths at which each bin after the first begins, longest first.
 *
 * With the bin count fixed by the data, the cuts are simply the largest relative
 * drops in the sorted lengths — there is no tolerance to tune. A threshold is the
 * *smallest* length of the bin above it, so a length belongs to the bin indexed
 * by how many thresholds exceed it.
 */
function findThresholds(lengths: number[], count: number): number[] {
	if (count < 2) {
		return [];
	}

	const descending = [...lengths].sort((a, b) => b - a);

	const drops: { drop: number; index: number }[] = [];

	for (let index = 0; index < descending.length - 1; index++) {
		const upper = descending[index];
		const lower = descending[index + 1];

		if (upper === undefined || lower === undefined || upper === 0) {
			continue;
		}

		drops.push({ drop: (upper - lower) / upper, index });
	}

	// Largest drop first, and the earliest of equal drops, so the cuts land in the
	// same places whatever order the sequences arrived in.
	drops.sort((a, b) => b.drop - a.drop || a.index - b.index);

	const thresholds: number[] = [];

	for (const { index } of drops.slice(0, count - 1)) {
		const threshold = descending[index];

		if (threshold !== undefined) {
			thresholds.push(threshold);
		}
	}

	return thresholds.sort((a, b) => b - a);
}

function binOf(length: number, thresholds: number[]): number {
	return thresholds.filter((threshold) => length < threshold).length;
}

/**
 * Match an OTU's sequences up across its isolates, one group per genome segment.
 *
 * Groups come back in the order they should be drawn: the schema's declared
 * segments in schema order, then any segment named but not declared, then the
 * length-inferred bins, longest first.
 *
 * A declared segment the analysis recorded no hit against is kept, with no
 * isolates contributing to it. Nothing mapped to it is a result about the
 * genome — the OTU was detected and this part of it was not — and dropping it
 * would show a partial detection as though the segment were never in the
 * reference. `declaredLengths` is what lets one be kept: its sequences are not in
 * the formatted result, so they can supply no width.
 */
export function groupSequencesIntoSegments<T extends SegmentedSequence>(
	isolates: T[][],
	schemaNames: string[],
	declaredLengths: Map<string, number> = new Map(),
): SegmentGroup<T>[] {
	const groups: SegmentGroup<T>[] = [];

	for (const name of schemaNames) {
		const matched = collect(isolates, (sequence) => sequence.segment === name);
		const declaredLength = declaredLengths.get(name) ?? 0;

		if (matched.length > 0 || declaredLength > 0) {
			groups.push({
				declaredLength,
				isolates: matched,
				key: `seg:${name}`,
				name,
			});
		}
	}

	// A patched OTU can carry a sequence naming a segment the schema at that
	// version does not declare — the checks that prevent it today run on writes,
	// not on history. The name is still a sound key, so the sequence keeps it and
	// only loses its place in the schema's order.
	const declared = new Set(schemaNames);
	const undeclared = new Set<string>();

	for (const sequences of isolates) {
		for (const sequence of sequences) {
			if (sequence.segment !== null && !declared.has(sequence.segment)) {
				undeclared.add(sequence.segment);
			}
		}
	}

	groups.push(
		...[...undeclared]
			.map((name) => ({
				declaredLength: declaredLengths.get(name) ?? 0,
				isolates: collect(isolates, (sequence) => sequence.segment === name),
				key: `seg:${name}`,
				name,
			}))
			.sort((a, b) => longestOf(b.isolates) - longestOf(a.isolates)),
	);

	const unassigned = isolates.map((sequences) =>
		sequences.filter((sequence) => sequence.segment === null),
	);

	const binCount = unassigned.reduce(
		(most, sequences) => Math.max(most, sequences.length),
		0,
	);

	const thresholds = findThresholds(
		unassigned.flat().map((sequence) => sequence.length),
		binCount,
	);

	for (let bin = 0; bin < binCount; bin++) {
		const matched = collect(
			unassigned,
			(sequence) => binOf(sequence.length, thresholds) === bin,
		);

		// A bin can come out empty when lengths tie across a cut, which only happens
		// where the lengths carry no signal to separate the segments by.
		if (matched.length > 0) {
			groups.push({
				declaredLength: 0,
				isolates: matched,
				key: `len:${bin}`,
				name: null,
			});
		}
	}

	return groups;
}
