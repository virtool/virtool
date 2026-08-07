import type { AnalysisMinimal } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/analyses/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so any test importing this helper can stub the
 * analysis server functions without per-file `vi.mock` boilerplate.
 */
export const analysisServerFnMocks = {
	findAnalysesFn: vi.fn(),
	getAnalysisFn: vi.fn(),
	getAnalysisResultsFn: vi.fn(),
	createAnalysisFn: vi.fn(),
	deleteAnalysisFn: vi.fn(),
	blastNuvsFn: vi.fn(),
};

/**
 * Sets up findAnalyses to resolve with a single page of the given analyses.
 *
 * @param analyses - the analyses on the page
 * @param foundCount - the number matching the filters, which defaults to the
 *   number on the page. Pass a larger value to model a page of a longer list.
 */
export function mockFindAnalyses(
	analyses: AnalysisMinimal[],
	foundCount?: number,
): Mock {
	analysisServerFnMocks.findAnalysesFn.mockResolvedValue({
		page: 1,
		pageCount: 1,
		perPage: 25,
		totalCount: analyses.length,
		foundCount: foundCount ?? analyses.length,
		items: analyses,
	});

	return analysisServerFnMocks.findAnalysesFn;
}

/**
 * Sets up createAnalysis to resolve with the given analysis.
 *
 * @param analysis - the analysis the mutation returns
 */
export function mockCreateAnalysis(analysis: AnalysisMinimal): Mock {
	analysisServerFnMocks.createAnalysisFn.mockResolvedValue(analysis);

	return analysisServerFnMocks.createAnalysisFn;
}

/** Sets up blastNuvs to resolve with a freshly created, unfinished BLAST. */
export function mockBlastNuvs(sequenceIndex: number): Mock {
	analysisServerFnMocks.blastNuvsFn.mockResolvedValue({
		id: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		lastCheckedAt: new Date(),
		error: null,
		interval: 3,
		ready: false,
		rid: null,
		result: null,
		sequenceIndex,
	});

	return analysisServerFnMocks.blastNuvsFn;
}
