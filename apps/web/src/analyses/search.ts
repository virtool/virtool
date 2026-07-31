/**
 * The presentation and filter state an analysis viewer reads from the URL.
 *
 * The route resolves every one of these before a component sees it, so nothing
 * downstream writes `search.x ?? default`. That pattern is what broke the
 * coverage filters: the switch read `filterOtus ?? true` and drew itself
 * pressed, while the hook that does the filtering read the same param raw and
 * saw `undefined`. Two defaults for one param, disagreeing.
 *
 * Anything with a viewer-wide default is therefore required here and carries
 * that default in `DEFAULT_ANALYSIS_SEARCH`, which the route also strips back
 * out of the URL. `sort` has no viewer-wide default — pathoscope ranks by
 * coverage and NuVs by length — so it stays optional and each toolbar names its
 * own.
 */
export type AnalysisSearch = {
	/** The hit shown in the NuVs detail pane */
	hit?: string;

	/** The sort direction, applied to whichever key is active */
	dir: "asc" | "desc";

	/** The term hits are searched by */
	find: string;

	/** The coverage a hit or isolate must reach to survive its filter, 0 to 1 */
	minCoverage: number;

	/** Show read pseudo-counts in place of weights */
	reads: boolean;

	/** Keep isolates whose coverage is under `minCoverage` */
	showLowIsolates: boolean;

	/** Keep OTUs whose coverage is under `minCoverage` */
	showLowOtus: boolean;

	/** Keep NuVs ORFs that got no HMM hit */
	showUnhitOrfs: boolean;

	/** Keep NuVs sequences that got no HMM hit */
	showUnhitSequences: boolean;

	/** The key hits are ranked by, named by the viewer showing them */
	sort?: string;

	/** Show pathoscope hits as a table rather than as coverage charts */
	table: boolean;
};

/**
 * The key each viewer ranks its hits by when the URL names none.
 *
 * `sort` is the one param whose default depends on what is being viewed, which
 * is why it is not in `DEFAULT_ANALYSIS_SEARCH` — a route that filled it in
 * would have to know the analysis's workflow before its results have loaded.
 * The toolbar and the sorting hook read it from here instead, so they cannot
 * disagree about which column is the active one.
 */
export const DEFAULT_SORT_KEY = {
	nuvs: "length",
	pathoscope: "coverage",
} as const;

/**
 * The coverage a hit or isolate must reach to survive its filter.
 *
 * The filter this replaced compared a hit's estimated read count against the
 * reads it would take to tile 80% of its genome — 0.8 genome-equivalents, which
 * is an expected breadth of `1 - e^-0.8`, or about 55%. Half is that figure,
 * rounded to something a person would pick.
 */
const DEFAULT_MIN_COVERAGE = 0.5;

/**
 * What every analysis search param means when the URL does not say.
 *
 * The route strips these values back out of the URL, so a viewer opened with
 * its filters at their defaults has no search params at all, and only the ones
 * a person actually changed are carried in a shared link.
 *
 * The two coverage filters and the two NuVs filters are named for what they
 * *keep* rather than what they hide, so that the filtering state — the one a
 * viewer opens in — is the absent one.
 */
export const DEFAULT_ANALYSIS_SEARCH: AnalysisSearch = {
	dir: "desc",
	find: "",
	minCoverage: DEFAULT_MIN_COVERAGE,
	reads: false,
	showLowIsolates: false,
	showLowOtus: false,
	showUnhitOrfs: false,
	showUnhitSequences: false,
	table: false,
};
