/**
 * Building a pathoscope run's context.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance — the open SQLite handles are made per step, from the paths recorded
 * here.
 */

import {
	type AnalysisIndex,
	type AnalysisRead,
	type AnalysisSubtraction,
	type BuildContextInput,
	fetchAnalysisMetadata,
	resolveAnalysisInputs,
	transferAnalysisInputs,
} from "@virtool/workflow";
import { workPaths } from "./paths";

/**
 * The minimum alignment score an alignment must reach to be counted.
 *
 * `p_score_cutoff` is not configurable; nothing overrides this default.
 */
export const P_SCORE_CUTOFF = 0.01;

/** The eagerly resolved data half of a pathoscope run's context. */
export type PathoscopeData = {
	/** The analysis this run finalizes */
	analysisId: number;

	/** The reference index the analysis is pinned to */
	index: AnalysisIndex;

	/** The sample's reads, in pair order */
	reads: AnalysisRead[];

	/** The subtractions to eliminate reads against, in the analysis's order */
	subtractions: AnalysisSubtraction[];

	/** @see {@link P_SCORE_CUTOFF} */
	pScoreCutoff: number;
};

export async function buildPathoscopeContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<PathoscopeData> {
	const metadata = await fetchAnalysisMetadata({ client, job, logger });
	const inputs = resolveAnalysisInputs(metadata, workPaths(workPath));

	await transferAnalysisInputs(storage, inputs, logger);

	return {
		analysisId: metadata.analysisId,
		index: inputs.index,
		reads: inputs.reads,
		pScoreCutoff: P_SCORE_CUTOFF,
		subtractions: inputs.subtractions,
	};
}
