import type { AnalysisSearch } from "@analyses/search";
import { DEFAULT_SORT_KEY } from "@analyses/search";
import { createFuse } from "@app/fuse";
import { normalizeSearchTerm } from "@app/search";
import type { PathoscopeHit } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import type { FormattedNuvsHit } from "./types";

/**
 * The value a pathoscope sort key ranks a hit by.
 *
 * The toolbar calls `pi` "Weight", because that is the term the results are
 * described in and nobody outside the workflow knows what pi is. The key it puts
 * in the URL is therefore not a field name.
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
 * The value a Nuvs sort key ranks a contig by.
 *
 * "Length" is the length of the contig's own sequence. A `NuvsHit` carries no
 * `length` field.
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

/** Search, filter, and sort pathoscope hits as the analysis search asks. */
export function sortAndFilterPathoscopeHits(
	hits: PathoscopeHit[],
	{
		dir,
		find,
		minCoverage,
		showLowOtus,
		sort,
	}: Pick<
		AnalysisSearch,
		"dir" | "find" | "minCoverage" | "showLowOtus" | "sort"
	>,
): PathoscopeHit[] {
	let found = hits;
	const normalizedFind = normalizeSearchTerm(find);

	if (normalizedFind) {
		found = createFuse(hits, ["name", "acronym"])
			.search(normalizedFind)
			.map((result) => result.item);
	}

	// Measured breadth, not a read budget: reads piled onto one conserved locus
	// buy an OTU the reads to tile its genome without covering any more of it.
	if (!showLowOtus) {
		found = found.filter((hit) => hit.coverage >= minCoverage);
	}

	const sorted = sortBy(found, [
		(hit) => pathoscopeSortValue(hit, sort ?? DEFAULT_SORT_KEY.pathoscope),
	]);

	// Descending is the default: a freshly-opened analysis should lead with its
	// strongest hits, not its weakest.
	if (dir === "desc") {
		sorted.reverse();
	}

	return sorted;
}

/** Search, filter, and sort Nuvs hits as the analysis search asks. */
export function sortAndFilterNuvsHits(
	hits: FormattedNuvsHit[],
	{
		find,
		showUnhitSequences,
		sort,
	}: Pick<AnalysisSearch, "find" | "showUnhitSequences" | "sort">,
): FormattedNuvsHit[] {
	let found = hits;
	const normalizedFind = normalizeSearchTerm(find);

	if (normalizedFind) {
		found = createFuse(hits, ["names", "families"])
			.search(normalizedFind)
			.map((result) => result.item);
	}

	if (!showUnhitSequences) {
		found = found.filter((hit) => hit.e !== null);
	}

	const sortKey = sort ?? DEFAULT_SORT_KEY.nuvs;
	const sorted = sortBy(found, [(hit) => nuvsSortValue(hit, sortKey)]);

	// The lowest e-value is the strongest hit, so that key alone reads upward.
	if (sortKey !== "e") {
		sorted.reverse();
	}

	return sorted;
}
