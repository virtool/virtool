import { formatIsolateName } from "@app/utils";
import type { Analysis } from "@virtool/contracts";
import { compact, uniq } from "es-toolkit/array";
import {
	flatMap,
	has,
	max,
	maxBy,
	min,
	minBy,
	reject,
	sortBy,
	sumBy,
} from "es-toolkit/compat";
import { median } from "es-toolkit/math";
import type {
	FormattedAnalysis,
	FormattedNuvsAnalysis,
	FormattedPathoscopeAnalysis,
	FormattedPathoscopeIsolate,
	FormattedPathoscopeSequence,
	NuvsOrf,
} from "./types";

export function calculateAnnotatedOrfCount(orfs: NuvsOrf[]) {
	return orfs.filter((orf) => orf.hits.length).length;
}

function calculateSequenceMinimumE(orfs: NuvsOrf[]) {
	if (orfs.length) {
		return min(
			orfs.map((orf) =>
				orf.hits.length ? (minBy(orf.hits, "full_e")?.full_e ?? 0) : 0,
			),
		);
	}
}

export function extractFamilies(orfs: NuvsOrf[]) {
	const families = uniq(
		flatMap(orfs, (orf) =>
			flatMap(orf.hits, (hit) => Object.keys(hit.families)),
		),
	);
	return reject(families, (f) => f === "None");
}

export function extractNames(orfs: NuvsOrf[]) {
	return uniq(flatMap(orfs, (orf) => flatMap(orf.hits, (hit) => hit.names)));
}

type FillAlignParams = {
	align?: number[][];
	length: number;
};

/**
 * Transform an array of coordinate pairs into an flat array where the index is the x coordinate and the value is the y
 * coordinate.
 *
 * @param {Array} align - the coordinates
 * @param length - the length of the generated flat array
 */
export function fillAlign({ align, length }: FillAlignParams) {
	if (!align) {
		return Array(length).fill(0);
	}

	const coords = Object.fromEntries(align);

	let prev = 0;

	return Array.from({ length }, (_, i) => {
		if (has(coords, i)) {
			prev = coords[i];
		}

		return prev;
	});
}

export function formatNuvsData(detail: FormattedNuvsAnalysis) {
	if (detail.results === null) {
		return detail;
	}

	const hits = detail.results.hits.map((hit) => ({
		...hit,
		id: Number(hit.index),
		annotatedOrfCount: calculateAnnotatedOrfCount(hit.orfs),
		e: calculateSequenceMinimumE(hit.orfs),
		families: extractFamilies(hit.orfs),
		names: extractNames(hit.orfs),
	}));

	const longestSequence = hits.reduce((longest, hit) =>
		hit.sequence.length > (longest?.sequence?.length ?? 0) ? hit : longest,
	);

	const { createdAt, id, ready, user, workflow } = detail;

	return {
		createdAt,
		id,
		ready,
		results: {
			...detail.results,
			hits,
		},
		user,
		workflow,
		maxSequenceLength: longestSequence.sequence.length,
	};
}

/**
 * The median read depth across `values`, rounded to a whole number of reads.
 *
 * Depth is displayed as a read count, so the half-value an even-length list
 * produces is rounded away here rather than in the shared `median` — the CSV and
 * XLSX exports report the unrounded figure, matching Python. An empty list has no
 * depth, which reads as zero rather than `NaN`.
 */
export function medianDepth(values: number[]): number {
	return values.length === 0 ? 0 : Math.round(median(values));
}

/**
 * Merge the coverage arrays for the given isolates.
 *
 * This is used to render a representative coverage chart for the parent OTU.
 */
export function mergeCoverage(
	isolates: Pick<FormattedPathoscopeIsolate, "filled">[],
): number[] {
	const longest = maxBy(isolates, (isolate) => isolate.filled.length);
	if (!longest) {
		return [];
	}
	const coverages = isolates.map((isolate) => isolate.filled);

	return longest.filled.map(
		(_depth, index) => max(coverages.map((coverage) => coverage[index])) ?? 0,
	);
}

/**
 * Reduce a per-position depth array to at most one value per pixel column.
 *
 * Coverage arrays are as long as the reference genome, which is orders of
 * magnitude more points than a chart a few hundred pixels wide can show. Each
 * bucket keeps its maximum depth so that narrow peaks survive.
 *
 * @param depths - the per-position read depths
 * @param width - the width of the chart in pixels
 */
export function downsampleDepths(depths: number[], width: number): number[] {
	if (width <= 0 || depths.length <= width) {
		return depths;
	}

	const buckets: number[] = [];

	for (let index = 0; index < width; index++) {
		const start = Math.floor((index * depths.length) / width);
		const end = Math.floor(((index + 1) * depths.length) / width);

		let peak = depths[start] ?? 0;

		for (let position = start + 1; position < end; position++) {
			const depth = depths[position] ?? 0;

			if (depth > peak) {
				peak = depth;
			}
		}

		buckets.push(peak);
	}

	return buckets;
}

export function formatSequence(
	sequence: FormattedPathoscopeSequence,
	readCount: number,
) {
	return {
		...sequence,
		filled: fillAlign(sequence),
		reads: sequence.pi * readCount,
	};
}

export function formatPathoscopeData(
	detail: FormattedPathoscopeAnalysis,
): FormattedPathoscopeAnalysis {
	if (detail.results === null || detail.results.hits.length === 0) {
		return detail;
	}

	const {
		createdAt,
		results,
		id,
		index,
		ready,
		reference,
		subtractions,
		user,
		workflow,
	} = detail;

	// The API delivers the raw analysis with snake_case totals; the formatter
	// re-exposes them as camelCase on the returned results.
	const rawResults = results as unknown as {
		read_count: number;
		subtracted_count: number;
	};

	const readCount = rawResults.read_count;

	const hits = results.hits.map((otu) => {
		// Go through each isolate associated with the OTU, adding properties for weight, read count,
		// median depth, and coverage. These values will be calculated from the sequences owned by each isolate.
		const isolateNames: string[] = [];
		const isolates = otu.isolates.map((isolate) => {
			// Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
			const name = formatIsolateName(isolate);

			isolateNames.push(name);

			const sequences = sortBy(
				isolate.sequences.map((sequence) =>
					formatSequence(sequence, readCount),
				),
				"length",
			);

			const filled = sequences.flatMap((seq) => seq.filled);

			// Coverage is the number of non-zero depth positions divided by the total number of positions.
			const coverage =
				filled.length === 0 ? 0 : compact(filled).length / filled.length;

			return {
				...isolate,
				name,
				filled,
				coverage,
				sequences,
				maxDepth: max(filled),
				pi: sumBy(sequences, (seq) => seq.pi),
				depth: medianDepth(filled),
			};
		});

		const filled = mergeCoverage(isolates);
		const pi = isolates.reduce((sum, isolate) => sum + isolate.pi, 0);

		const maxCoverageIsolate = isolates.reduce((maxIsolate, isolate) =>
			isolate.coverage > maxIsolate.coverage ? isolate : maxIsolate,
		);
		const maxFilledLengthIsolate = isolates.reduce((maxIsolate, isolate) =>
			isolate.filled.length > maxIsolate.filled.length ? isolate : maxIsolate,
		);
		const maxDepthIsolate = isolates.reduce((maxIsolate, isolate) =>
			isolate.maxDepth > maxIsolate.maxDepth ? isolate : maxIsolate,
		);

		return {
			...otu,
			filled,
			pi,
			isolates: sortBy(isolates, (i) => i.coverage).reverse(),
			coverage: maxCoverageIsolate.coverage,
			depth: medianDepth(filled),
			isolateNames: reject(
				uniq(isolateNames),
				(name) => name === "Unnamed Isolate",
			),
			maxGenomeLength: maxFilledLengthIsolate.filled.length,
			maxDepth: maxDepthIsolate.maxDepth,
			reads: pi * readCount,
		};
	});

	return {
		...detail,
		createdAt,
		id,
		index,
		reference,
		ready,
		results: {
			hits,
			readCount,
			subtractedCount: rawResults.subtracted_count,
		},
		subtractions,
		user,
		workflow,
	};
}

export function formatData(detail: Analysis): FormattedAnalysis {
	if (detail?.workflow === "pathoscope") {
		return formatPathoscopeData(
			detail as unknown as FormattedPathoscopeAnalysis,
		);
	}

	if (detail?.workflow === "nuvs") {
		return formatNuvsData(
			detail as unknown as FormattedNuvsAnalysis,
		) as FormattedAnalysis;
	}

	return detail;
}

const supportedWorkflows: string[] = ["pathoscope", "nuvs"];

export function checkSupportedWorkflow(workflow: string) {
	return supportedWorkflows.includes(workflow);
}
