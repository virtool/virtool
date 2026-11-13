import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import {
	sortAndFilterNuvsHits,
	sortAndFilterPathoscopeHits,
} from "@analyses/hits";
import { useListReadyIndexes } from "@indexes/queries";
import { useFetchSample } from "@samples/queries";
import { useFetchSubtractionsShortlist } from "@subtraction/queries";
import type { SubtractionOption } from "@subtraction/types";
import type { IndexMinimal } from "@virtool/contracts";
import { groupBy, maxBy } from "es-toolkit";
import type {
	FormattedNuvsAnalysis,
	FormattedNuvsHit,
	FormattedPathoscopeAnalysis,
} from "./types";

/** Sort and filter a list of pathoscope hits  */
export function useSortAndFilterPathoscopeHits(
	detail: FormattedPathoscopeAnalysis,
) {
	const { search } = useAnalysisSearch();

	return sortAndFilterPathoscopeHits(detail.results.hits, search);
}

/** Sort and filter a list of Nuvs hits  */
export function useSortAndFilterNuvsHits(detail: FormattedNuvsAnalysis) {
	const { search } = useAnalysisSearch();

	return sortAndFilterNuvsHits(detail.results.hits, search);
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

function useCompatibleIndexes(): UseCompatibleIndexesResult {
	const { data, isPending, isError } = useListReadyIndexes(false);

	const indexes = Object.values(
		groupBy(data ?? [], (item) => item.reference.id),
	)
		.map((group) => maxBy(group, (item) => Number(item.version)))
		.filter((index): index is IndexMinimal => index !== undefined);

	return { indexes, isPending, isError: isError && data === undefined };
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
function useSubtractionOptions(
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

	if (
		(isErrorSample && !sample) ||
		(isErrorSubtractionShortlist && !subtractionShortlist)
	) {
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

type UseCreateAnalysisOptionsResult = {
	defaultSubtractions: SubtractionOption[];
	indexes: IndexMinimal[];
	subtractions: SubtractionOption[];
	isError: boolean;
	isPending: boolean;
};

/**
 * Load indexes and subtractions together so the form can appear all at once.
 */
export function useCreateAnalysisOptions(
	sampleIds: number[],
): UseCreateAnalysisOptionsResult {
	const {
		indexes,
		isPending: isPendingIndexes,
		isError: isErrorIndexes,
	} = useCompatibleIndexes();

	const {
		defaultSubtractions,
		subtractions,
		isPending: isPendingSubtractions,
		isError: isErrorSubtractions,
	} = useSubtractionOptions(sampleIds);

	return {
		defaultSubtractions,
		indexes,
		subtractions,
		isError: isErrorIndexes || isErrorSubtractions,
		isPending: isPendingIndexes || isPendingSubtractions,
	};
}
