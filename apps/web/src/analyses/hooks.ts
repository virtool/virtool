import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { DEFAULT_SORT_KEY } from "@analyses/search";
import { createFuse } from "@app/fuse";
import { useListReadyIndexes } from "@indexes/queries";
import { useFetchSample } from "@samples/queries";
import { useFetchSubtractionsShortlist } from "@subtraction/queries";
import type { SubtractionOption } from "@subtraction/types";
import type { IndexMinimal, PathoscopeHit } from "@virtool/contracts";
import { groupBy, maxBy, sortBy } from "es-toolkit";
import type {
	FormattedNuvsAnalysis,
	FormattedNuvsHit,
	FormattedPathoscopeAnalysis,
} from "./types";

/**
 * The value a pathoscope sort key ranks a hit by.
 *
 * The toolbar calls `pi` "Weight", because that is the term the results are
 * described in and nobody outside the workflow knows what pi is. The key it puts
 * in the URL is therefore not a field name, and sorting by it read `undefined`
 * off every hit — leaving the list in whatever order it already had.
 *
 * Names are compared lower-cased, so an OTU named "adenovirus" is not ranked
 * behind every capitalised name by the codepoint order a raw comparison gives.
 */
function pathoscopeSortValue(
	hit: PathoscopeHit,
	sortKey: string,
): number | string {
	switch (sortKey) {
		case "name":
			return hit.name.toLowerCase();
		case "weight":
			return hit.pi;
		case "depth":
			return hit.depth;
		default:
			return hit.coverage;
	}
}

/**
 * The value a NuVs sort key ranks a contig by.
 *
 * "Length" is the length of the contig's own sequence. A `NuvsHit` carries no
 * `length` field — reading the key off the hit gave `undefined` for every one of
 * them, so the list stayed in the workflow's output order while the toolbar
 * reported it was sorted by length.
 *
 * A contig with no ORF hits has no e-value. It ranks last rather than first,
 * where `null` would otherwise put it: it is the absence of a hit, not the
 * strongest one.
 */
function nuvsSortValue(hit: FormattedNuvsHit, sortKey: string): number {
	switch (sortKey) {
		case "e":
			return hit.e ?? Number.POSITIVE_INFINITY;
		case "orfs":
			return hit.annotatedOrfCount;
		default:
			return hit.sequence.length;
	}
}

/** Sort and filter a list of pathoscope hits  */
export function useSortAndFilterPathoscopeHits(
	detail: FormattedPathoscopeAnalysis,
) {
	let hits = detail.results.hits;

	const {
		search: { dir, find, minCoverage, showLowOtus, sort },
	} = useAnalysisSearch();

	const fuse = createFuse(hits, ["name", "abbreviation"]);

	if (find) {
		hits = fuse.search(find).map((result) => result.item);
	}

	// Measured breadth, not a read budget: reads piled onto one conserved locus
	// buy an OTU the reads to tile its genome without covering any more of it.
	if (!showLowOtus) {
		hits = hits.filter((hit) => hit.coverage >= minCoverage);
	}

	const sortedHits = sortBy(hits, [
		(hit) => pathoscopeSortValue(hit, sort ?? DEFAULT_SORT_KEY.pathoscope),
	]);

	// Descending is the default: a freshly-opened analysis should lead with its
	// strongest hits, not its weakest.
	if (dir === "desc") {
		sortedHits.reverse();
	}

	return sortedHits;
}

/** Sort and filter a list of Nuvs hits  */
export function useSortAndFilterNuVsHits(detail: FormattedNuvsAnalysis) {
	let hits = detail.results.hits;

	const {
		search: { find, showUnhitSequences, sort },
	} = useAnalysisSearch();

	const fuse = createFuse(hits, ["names", "families"]);

	if (find) {
		hits = fuse.search(find).map((result) => result.item);
	}

	if (!showUnhitSequences) {
		hits = hits.filter((hit) => hit.e !== null);
	}

	const sortKey = sort ?? DEFAULT_SORT_KEY.nuvs;

	const sortedHits = sortBy(hits, [(hit) => nuvsSortValue(hit, sortKey)]);

	// The lowest e-value is the strongest hit, so that key alone reads upward.
	if (sortKey !== "e") {
		sortedHits.reverse();
	}

	return sortedHits;
}

export function useActiveHit(matches: FormattedNuvsHit[]) {
	const {
		search: { hit },
	} = useAnalysisSearch();

	if (hit) {
		return (
			matches.find((match) => match.id === Number(hit)) ?? matches[0] ?? null
		);
	}

	return matches[0] ?? null;
}

type UseCompatibleIndexesResult = {
	indexes: IndexMinimal[];
	isPending: boolean;
	isError: boolean;
};

export function useCompatibleIndexes(): UseCompatibleIndexesResult {
	const { data, isPending, isError } = useListReadyIndexes(false);

	const indexes = Object.values(
		groupBy(data ?? [], (item) => item.reference.id),
	)
		.map((group) => maxBy(group, (item) => Number(item.version)))
		.filter((index): index is IndexMinimal => index !== undefined);

	return { indexes, isPending, isError };
}

type UseSubtractionOptionsResult = {
	defaultSubtractions: SubtractionOption[];
	subtractions: SubtractionOption[];
	isPending: boolean;
	isError: boolean;
};

/**
 * Get the available subtraction options for a list of sample ids.
 *
 * Subtractions that are not ready are filtered out.
 *
 * If more than one sample id is passed, the default subtractions list will be
 * empty. Default subtractions aggregated for multiple samples are confusing and
 * costly to request.
 *
 * @param sampleIds
 */
export function useSubtractionOptions(
	sampleIds: number[],
): UseSubtractionOptionsResult {
	const {
		data: subtractionShortlist,
		isPending: isPendingSubtractionShortlist,
		isError: isErrorSubtractionShortlist,
	} = useFetchSubtractionsShortlist();

	const sampleId = sampleIds[0] ?? Number.NaN;

	const {
		data: sample,
		isPending: isPendingSample,
		isError: isErrorSample,
	} = useFetchSample(sampleId);

	if (isErrorSample || isErrorSubtractionShortlist) {
		return {
			defaultSubtractions: [],
			subtractions: [],
			isPending: false,
			isError: true,
		};
	}

	if (
		isPendingSample ||
		isPendingSubtractionShortlist ||
		!sample ||
		!subtractionShortlist
	) {
		return {
			defaultSubtractions: [],
			subtractions: [],
			isPending: true,
			isError: false,
		};
	}

	const defaultSubtractionIds =
		sampleIds.length === 1
			? sample.subtractions.map((subtraction) => subtraction.id)
			: [];

	const subtractions = subtractionShortlist
		.map((subtraction) => {
			return {
				...subtraction,
				isDefault: defaultSubtractionIds.includes(subtraction.id),
			};
		})
		.filter((subtraction) => subtraction.ready);

	const defaultSubtractions = subtractions.filter(
		(subtraction) => subtraction.isDefault,
	);

	return {
		defaultSubtractions,
		subtractions,
		isPending: false,
		isError: false,
	};
}
