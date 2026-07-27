import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { createFuse } from "@app/fuse";
import { useListIndexes } from "@indexes/queries";
import type { IndexMinimal } from "@indexes/types";
import { useFetchSample } from "@samples/queries";
import { useFetchSubtractionsShortlist } from "@subtraction/queries";
import type { SubtractionOption } from "@subtraction/types";
import type { PathoscopeHit } from "@virtool/contracts";
import { groupBy, maxBy, sortBy } from "es-toolkit";
import type {
	FormattedNuvsAnalysis,
	FormattedNuvsHit,
	FormattedPathoscopeAnalysis,
} from "./types";

/**
 * The hit field a pathoscope sort key names.
 *
 * The toolbar calls `pi` "Weight", because that is the term the results are
 * described in and nobody outside the workflow knows what pi is. The key it puts
 * in the URL is therefore not a field name, and sorting by it read `undefined`
 * off every hit — leaving the list in whatever order it already had.
 */
function pathoscopeSortField(sort: string | undefined): keyof PathoscopeHit {
	if (sort === "weight") {
		return "pi";
	}

	return sort === "depth" ? "depth" : "coverage";
}

/** Sort and filter a list of pathoscope hits  */
export function useSortAndFilterPathoscopeHits(
	detail: FormattedPathoscopeAnalysis,
	maxReadLength: number,
) {
	let hits = detail.results.hits;

	const {
		search: { find, filterOtus, sort, sortDesc },
	} = useAnalysisSearch();

	const fuse = createFuse(hits, ["name", "abbreviation"]);

	if (find) {
		hits = fuse.search(String(find)).map((result) => result.item);
	}

	if (filterOtus) {
		hits = hits.filter(
			(hit) =>
				hit.pi * detail.results.readCount >= (hit.length * 0.8) / maxReadLength,
		);
	}

	const sortedHits = sortBy(hits, [(hit) => hit[pathoscopeSortField(sort)]]);

	if (sortDesc) {
		sortedHits.reverse();
	}

	return sortedHits;
}

/** Sort and filter a list of Nuvs hits  */
export function useSortAndFilterNuVsHits(detail: FormattedNuvsAnalysis) {
	let hits = detail.results.hits;

	const {
		search: { find, filterSequences, sort },
	} = useAnalysisSearch();

	const fuse = createFuse(hits, ["names", "families"]);

	if (find) {
		hits = fuse.search(String(find)).map((result) => result.item);
	}

	if (filterSequences) {
		hits = hits.filter((hit) => hit.e !== null);
	}

	const sortedHits =
		sort === "orfs"
			? sortBy(hits, [(hit) => hit.annotatedOrfCount]).reverse()
			: sortBy(hits, [(hit) => hit[sort as keyof FormattedNuvsHit]]);

	return sortedHits;
}

export function useActiveHit(matches: FormattedNuvsHit[]) {
	const {
		search: { activeHit },
	} = useAnalysisSearch();

	if (activeHit) {
		return (
			matches.find((match) => match.id === Number(activeHit)) ??
			matches[0] ??
			null
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
	const { data, isPending, isError } = useListIndexes({
		ready: true,
		archived: false,
	});

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
