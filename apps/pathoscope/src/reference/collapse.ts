/**
 * Collapsing redundant isolates out of a reference index.
 *
 * The port of Python's `reference.py`, and the largest piece of logic in this
 * workflow. An OTU's isolates frequently differ by a handful of bases;
 * `cd-hit-est` clusters them at 99% identity and every isolate whose sequences
 * land on the same representatives as an earlier one is dropped. What survives
 * is written to a second index artifact this workflow then maps against.
 *
 * ## Order decides which duplicate survives
 *
 * Isolates are visited in the order the index yields them, and the **first**
 * isolate seen with a given representative set is the one kept. `iterOtus`
 * returns insertion order for exactly this reason. So does `cd-hit-est`, which
 * picks its representative by the order it reads sequences in — which is why the
 * index reader's no-op `ORDER BY` clauses have to stay.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	IndexOtu,
	IndexOtuIsolate,
	IndexOtuSequence,
	WorkflowIndex,
} from "@virtool/sqlite";
import type { RunSubprocess } from "@virtool/workflow";
import { parseCdHitClusters } from "./clusters";

export const CD_HIT_EST_TOOL = "cd-hit-est";

/** The identity threshold every cd-hit-est run in this workflow uses. */
export const CD_HIT_EST_IDENTITY = "0.99";

/** What collapsing did to one OTU. */
export type OtuCollapseOutcome = "collapsed" | "unchanged" | "skipped";

/** The counts the collapse step reports. */
export type ReferenceCollapseSummary = {
	isolate_count_before: number;
	isolate_count_after: number;
	isolate_count_removed: number;
	otu_count_collapsed: number;
	otu_count_unchanged: number;
	otu_count_skipped: number;
};

/** Runs `cd-hit-est` over one segment's FASTA and reads back its clusters. */
export type CollapseSegment = (
	inputPath: string,
	outputPath: string,
	sequences: readonly IndexOtuSequence[],
) => Promise<Map<string, string>>;

/**
 * Group an OTU's sequences by segment, when its structure is safe to collapse.
 *
 * Any violation makes the OTU `skipped` and it passes through untouched.
 * Collapsing compares isolates by the *set* of representatives their sequences
 * land on, so a structure that would make two isolates' sets incomparable —
 * an unsegmented OTU whose isolates carry different numbers of sequences, or a
 * segmented one where an isolate repeats a segment — has to be left alone rather
 * than guessed at.
 *
 * @returns the grouping, or `null` when the OTU is not eligible.
 */
export function prepareOtuCollapse(
	otu: IndexOtu,
): Map<string, IndexOtuSequence[]> | null {
	const sequencesBySegment = new Map<string, IndexOtuSequence[]>();

	function push(segment: string, sequence: IndexOtuSequence): void {
		const existing = sequencesBySegment.get(segment);

		if (existing) {
			existing.push(sequence);
		} else {
			sequencesBySegment.set(segment, [sequence]);
		}
	}

	if (otu.schema.length === 0) {
		for (const isolate of otu.isolates) {
			const [only] = isolate.sequences;

			// With no schema there is nothing to match sequences up by, so the only
			// comparable shape is one sequence per isolate.
			if (isolate.sequences.length !== 1 || only === undefined) {
				return null;
			}

			push("", only);
		}

		return sequencesBySegment;
	}

	const schemaSegments = new Set(otu.schema.map((item) => item.name));

	for (const isolate of otu.isolates) {
		const isolateSegments = new Set<string>();

		for (const sequence of isolate.sequences) {
			const segment = sequence.segment;

			if (typeof segment !== "string" || segment === "") {
				return null;
			}

			if (!schemaSegments.has(segment)) {
				return null;
			}

			if (isolateSegments.has(segment)) {
				return null;
			}

			isolateSegments.add(segment);

			push(segment, sequence);
		}
	}

	return sequencesBySegment;
}

/**
 * Run `run` over `items`, at most `limit` at a time.
 *
 * Batched rather than a sliding window, so a batch waits for its slowest member.
 * An OTU has a handful of segments at most — one for an unsegmented OTU — so the
 * difference against a true window is not measurable, and this is a dozen lines
 * against a semaphore's subtle slot-handoff invariant.
 */
async function mapWithLimit<T, R>(
	items: readonly T[],
	limit: number,
	run: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = [];

	for (let start = 0; start < items.length; start += limit) {
		results.push(
			...(await Promise.all(items.slice(start, start + limit).map(run))),
		);
	}

	return results;
}

/**
 * Run one `cd-hit-est` per segment and merge the representative maps.
 *
 * Segments are sorted by name so the run is reproducible, and the file names
 * carry the segment name for the same reason.
 */
async function collapseOtuSegments(
	otu: IndexOtu,
	sequencesBySegment: Map<string, IndexOtuSequence[]>,
	tempPath: string,
	collapseSegment: CollapseSegment,
	limit: number,
): Promise<Map<string, string>> {
	const sorted = [...sequencesBySegment.entries()].sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);

	const maps = await mapWithLimit(sorted, limit, ([segmentName, sequences]) =>
		collapseSegment(
			join(tempPath, `otu-${otu.id}-segment-${segmentName}.fa`),
			join(tempPath, `otu-${otu.id}-segment-${segmentName}.cdhit`),
			sequences,
		),
	);

	const merged = new Map<string, string>();

	for (const map of maps) {
		for (const [sequenceId, representativeId] of map) {
			merged.set(sequenceId, representativeId);
		}
	}

	return merged;
}

/**
 * The representatives an isolate's sequences land on, as a comparable key.
 *
 * Python builds a `frozenset` and compares by value; the nearest thing here is
 * a sorted, joined string. A `Set` compares by identity, so using one would make
 * every isolate look unique and collapse nothing.
 */
function representativeKey(
	isolate: IndexOtuIsolate,
	representativesBySequenceId: Map<string, string>,
): string {
	const representatives = new Set<string>();

	for (const sequence of isolate.sequences) {
		const representative = representativesBySequenceId.get(sequence.id);

		// Python indexes the dict directly and raises `KeyError`. Every sequence
		// handed to cd-hit-est comes back in its cluster file, so this fires only
		// if the cluster file was truncated or the wrong one was read — both of
		// which would otherwise collapse isolates against a partial key.
		if (representative === undefined) {
			throw new Error(
				`No cd-hit-est cluster representative for sequence ${sequence.id} of isolate ${isolate.id}`,
			);
		}

		representatives.add(representative);
	}

	return [...representatives].sort().join("\0");
}

/** One OTU's collapsed form, what happened to it, and what it came in as. */
export type OtuCollapseResult = {
	/** The OTU as the index yielded it, for the isolate count before collapsing */
	source: IndexOtu;

	/** The OTU as it should be written — the same object when nothing changed */
	otu: IndexOtu;

	outcome: OtuCollapseOutcome;
};

/**
 * Collapse one OTU's isolates.
 *
 * `limit` bounds how many `cd-hit-est` runs this OTU has in flight at once. Each
 * is given `-T 1`, so the parallelism is here rather than in the tool.
 */
export async function collapseOtu(
	otu: IndexOtu,
	tempPath: string,
	collapseSegment: CollapseSegment,
	limit = 1,
): Promise<OtuCollapseResult> {
	// Checked before eligibility: one isolate cannot be redundant with anything,
	// so there is no cd-hit-est run to pay for.
	if (otu.isolates.length === 1) {
		return { source: otu, otu, outcome: "unchanged" };
	}

	const sequencesBySegment = prepareOtuCollapse(otu);

	if (sequencesBySegment === null) {
		return { source: otu, otu, outcome: "skipped" };
	}

	const representativesBySequenceId = await collapseOtuSegments(
		otu,
		sequencesBySegment,
		tempPath,
		collapseSegment,
		limit,
	);

	const defaultSequenceIds = new Set(
		otu.isolates
			.filter((isolate) => isolate.default)
			.flatMap((isolate) => isolate.sequences.map((sequence) => sequence.id)),
	);

	const seenRepresentativeSets = new Set<string>();
	const collapsedIsolates: IndexOtuIsolate[] = [];

	for (const isolate of otu.isolates) {
		const key = representativeKey(isolate, representativesBySequenceId);

		const firstForSet = !seenRepresentativeSets.has(key);

		seenRepresentativeSets.add(key);

		// A no-op, and deliberately kept: a sequence has exactly one parent
		// isolate, so this is true precisely when `isolate.default` is. Python's
		// `reference.py` carries the same redundancy and still releases the
		// production workflow, so the two collapse loops stay diffable until it
		// retires. VIR-2938 deletes it in both.
		const containsDefaultSequence = isolate.sequences.some((sequence) =>
			defaultSequenceIds.has(sequence.id),
		);

		if (isolate.default || containsDefaultSequence || firstForSet) {
			collapsedIsolates.push(isolate);
		}
	}

	return {
		source: otu,
		otu: { ...otu, isolates: collapsedIsolates },
		outcome: "collapsed",
	};
}

/** Write one segment's sequences as FASTA, the input to a `cd-hit-est` run. */
export async function writeSegmentFasta(
	path: string,
	sequences: readonly IndexOtuSequence[],
): Promise<void> {
	// One OTU segment across every isolate — kilobytes, not the whole index — so
	// this is the one place in the workflow a whole-file write is safe.
	await writeFile(
		path,
		sequences
			.map((sequence) => `>${sequence.id}\n${sequence.sequence}\n`)
			.join(""),
	);
}

/**
 * Run `cd-hit-est` over one segment and read back its clusters.
 *
 * The output is named `otu-{id}-segment-{name}.cdhit`, so the cluster file
 * cd-hit-est writes beside it is `otu-{id}-segment-{name}.cdhit.clstr`. Python
 * spells that `Path.with_suffix(".cdhit.clstr")`, which *replaces* the `.cdhit`
 * suffix rather than appending to it and so lands on the same name. Appending
 * `.clstr` to the output path is what cd-hit-est actually does; do not "fix" it
 * to `.cdhit.clstr` on top of a path that already ends in `.cdhit`.
 */
export function createSegmentCollapser(
	runSubprocess: RunSubprocess,
): CollapseSegment {
	return async (inputPath, outputPath, sequences) => {
		await writeSegmentFasta(inputPath, sequences);

		await runSubprocess({
			command: [
				CD_HIT_EST_TOOL,
				"-i",
				inputPath,
				"-o",
				outputPath,
				"-c",
				CD_HIT_EST_IDENTITY,
				"-T",
				"1",
				"-M",
				"0",
				"-d",
				"0",
			],
		});

		return parseCdHitClusters(`${outputPath}.clstr`);
	};
}

/**
 * Collapse every OTU in `index`, one at a time.
 *
 * An async generator so the caller can stream the survivors straight into the
 * artifact writer without holding a collapsed reference in memory. It yields the
 * full {@link OtuCollapseResult} rather than the OTU alone, so the caller tallies
 * what it needs — the alternative was a caller-allocated summary object filled
 * in as a side effect, whose `isolate_count_removed` was only correct once the
 * generator had been drained, which nothing at the call site showed.
 */
export async function* collapseOtus(
	index: WorkflowIndex,
	tempPath: string,
	collapseSegment: CollapseSegment,
	limit: number,
): AsyncGenerator<OtuCollapseResult> {
	for await (const otu of index.iterOtus()) {
		// One OTU at a time. `limit` bounds the segments *within* an OTU, which is
		// where the only concurrency is — an earlier version threaded a semaphore
		// through from the caller to bound something that never crossed this loop.
		const result = await collapseOtu(otu, tempPath, collapseSegment, limit);

		yield result;
	}
}

/** Running totals over {@link collapseOtus}' results. */
export function createCollapseTally(): {
	record: (result: OtuCollapseResult) => void;
	summary: () => ReferenceCollapseSummary;
} {
	const outcomes = { collapsed: 0, unchanged: 0, skipped: 0 };

	let before = 0;
	let after = 0;

	return {
		record({ source, otu, outcome }) {
			before += source.isolates.length;
			after += otu.isolates.length;
			outcomes[outcome] += 1;
		},
		summary: () => ({
			isolate_count_before: before,
			isolate_count_after: after,
			isolate_count_removed: before - after,
			otu_count_collapsed: outcomes.collapsed,
			otu_count_unchanged: outcomes.unchanged,
			otu_count_skipped: outcomes.skipped,
		}),
	};
}
