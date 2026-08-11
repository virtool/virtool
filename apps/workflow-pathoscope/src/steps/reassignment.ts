import type { FinalizeAnalysisRequest, JsonObject } from "@virtool/contracts";
import type { JobsApiClient } from "@virtool/workflow";
import { openWorkflowIndex } from "@virtool/workflow";
import { runExpectationMaximization } from "../pathoscopeCore";
import { workPaths } from "../paths";
import { buildReport } from "../report";
import type { PathoscopeStep } from "./types";

/** How many decimal places a hit's coverage proportion keeps. */
const COVERAGE_PLACES = 3;

/**
 * Reassign the multi-mapping reads and finalize the analysis.
 *
 * A read that aligned to twenty isolates of the same OTU has to be attributed to
 * one of them; expectation maximization does that by iterating on the whole
 * assignment at once, so an isolate well supported elsewhere pulls its ambiguous
 * reads in. What comes back is the abundance figures the analysis is made of.
 *
 * **This is the only step that finalizes**, and it does so on both paths —
 * including the empty-candidate one, which still owes the analysis a result.
 */
export const reassignmentStep: PathoscopeStep = {
	id: "reassignment",
	description: "Run the Pathoscope reassignment algorithm.",
	async run({ client, data, logger, runSubprocess, state, workPath }) {
		const paths = workPaths(workPath);

		if (state.candidateSequenceIds.length === 0) {
			logger.info("no candidate otus found; uploading empty result");

			await finalize(client, data.analysisId, {
				subtracted_count: state.subtractedCount,
				read_count: 0,
				hits: [],
			});

			return;
		}

		const results = await runExpectationMaximization(
			{ runSubprocess, outputPath: paths.coreResults("em") },
			{
				alignmentPath: paths.subtractedBam,
				pScoreCutoff: data.pScoreCutoff,
			},
		);

		const report = buildReport(results);

		const index = openWorkflowIndex({
			id: data.index.id,
			path: paths.collapsedReference,
		});

		let hits: JsonObject[];

		try {
			const otuRefs = await index.getOtuRefsBySequenceIds(
				report.map((entry) => entry.id),
			);

			hits = report.map((entry) => {
				const otuRef = otuRefs[entry.id];

				// `getOtuRefsBySequenceIds` throws on an id it cannot resolve, so this
				// is unreachable; it is here because the alternative is a hit with no
				// OTU, which renders as an unnamed row.
				if (!otuRef) {
					throw new Error(`No OTU for sequence ${entry.id}`);
				}

				const coverage = results.coverage[entry.id] ?? [];

				return {
					...entry,
					otu: { id: otuRef.id, version: otuRef.version },
					align: coverage,
					...summarizeCoverage(coverage),
				};
			});
		} finally {
			index.close();
		}

		await finalize(client, data.analysisId, {
			subtracted_count: state.subtractedCount,
			read_count: results.read_count,
			hits,
		});

		logger.info({ hitCount: hits.length }, "finalized analysis");
	},
};

/**
 * Reduce a per-position depth array to the two figures a hit carries.
 *
 * `coverage` is the proportion of positions with any depth at all — how much of
 * the reference was seen — and `depth` is the mean depth across the whole
 * reference, rounded to whole reads.
 */
function summarizeCoverage(coverage: readonly number[]): {
	coverage: number;
	depth: number;
} {
	if (coverage.length === 0) {
		return { coverage: 0, depth: 0 };
	}

	let zeroes = 0;
	let total = 0;

	for (const depth of coverage) {
		total += depth;

		if (depth === 0) {
			zeroes += 1;
		}
	}

	const covered = 1 - zeroes / coverage.length;

	return {
		coverage: Number(covered.toFixed(COVERAGE_PLACES)),
		depth: Math.round(total / coverage.length),
	};
}

/**
 * Record the run's output against the analysis.
 *
 * **The manifest is empty, and that is the point.** Pathoscope's entire output
 * is `results`; Python also wrote a `report.tsv` and uploaded it, but every
 * figure in that file is in this blob and nothing ever read it back.
 */
async function finalize(
	client: JobsApiClient,
	analysisId: number,
	results: JsonObject,
): Promise<void> {
	const body: FinalizeAnalysisRequest = { results, files: [] };

	await client.request({
		method: "PATCH",
		path: `/analyses/${analysisId}`,
		body,
	});
}
