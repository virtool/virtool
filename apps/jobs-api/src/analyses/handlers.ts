import type { Analysis, WorkflowAnalysis } from "@virtool/contracts";
import { FinalizeAnalysisRequest } from "@virtool/contracts";
import {
	AnalysisAlreadyFinalizedError,
	AnalysisNotFoundError,
	AnalysisNotOwnedError,
	finalizeAnalysis,
	getAnalysis,
} from "@virtool/data/analyses/data";
import { requireJobRequest } from "../auth/guard";
import { type FinalizeHandlerDeps, finalizeResource } from "../finalize";
import { jsonError, type ReadHandlerDeps, requireRowId } from "../http";

/** What the analysis finalize route needs to serve a request. */
export type AnalysisHandlerDeps = FinalizeHandlerDeps;

/**
 * Narrow an analysis to what a workflow reads.
 *
 * `sample` stays an object carrying an id. Python's runtime falls back to
 * reading it when a job's `args` carry no `sample_id`, so flattening it to a
 * bare id breaks every analysis whose job was created without one.
 *
 * The results blob and the file rows are both dropped. A workflow reading an
 * analysis is about to produce them, and `getAnalysis` deliberately does not
 * read `results` — that is `getAnalysisResults`, which runs the history-patching
 * format step this read must never pay for.
 */
function toWorkflowAnalysis(analysis: Analysis): WorkflowAnalysis {
	return {
		id: analysis.id,
		index: { id: analysis.index.id, version: analysis.index.version },
		ready: analysis.ready,
		reference: {
			id: analysis.reference.id,
			name: analysis.reference.name,
		},
		sample: { id: analysis.sample.id, name: analysis.sample.name },
		subtractions: analysis.subtractions.map((subtraction) => ({
			id: subtraction.id,
			name: subtraction.name,
		})),
		workflow: analysis.workflow,
	};
}

/**
 * Serve the analysis a workflow is running: the index and reference it is
 * pinned to, the sample it came from, and the subtractions it must apply.
 *
 * Records only, and no results — see {@link toWorkflowAnalysis}.
 */
export async function handleGetAnalysis(
	deps: ReadHandlerDeps,
	request: Request,
	analysisIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const analysisId = requireRowId(analysisIdParam, "Analysis not found");

	if (analysisId instanceof Response) {
		return analysisId;
	}

	try {
		return Response.json(
			toWorkflowAnalysis(await getAnalysis(deps.db, analysisId)),
		);
	} catch (err) {
		if (err instanceof AnalysisNotFoundError) {
			return jsonError(404, "Analysis not found");
		}

		throw err;
	}
}

/**
 * Finalize an analysis: record its results blob and the files the workflow
 * retained, and flip it ready.
 *
 * Unlike a subtraction or a sample, the filenames here are the workflow's to
 * choose — a NuVs run names its own FASTA and HMM outputs — so they are checked
 * for shape rather than against a whitelist. The download route addresses these
 * by row id, not by name.
 *
 * A job may only finalize the analysis it was started for. That check is the
 * resource counterpart of `requireOwnJob` on the lifecycle routes, and answers
 * the same 403 — but it is `analyses.job_id` that decides it, so it happens
 * inside the same statement that writes, not in a guard here.
 */
export async function handleFinalizeAnalysis(
	deps: AnalysisHandlerDeps,
	request: Request,
	analysisIdParam: string,
): Promise<Response> {
	return await finalizeResource(deps, request, analysisIdParam, {
		body: FinalizeAnalysisRequest,
		prefix: (analysisId) => `analyses/${analysisId}/`,
		allowedNames: null,
		notFound: { error: AnalysisNotFoundError, message: "Analysis not found" },
		notOwned: {
			error: AnalysisNotOwnedError,
			message: "Job was not started for this analysis",
		},
		alreadyFinalized: {
			error: AnalysisAlreadyFinalizedError,
			message: "Analysis has already been finalized",
		},
		write: async ({ id: analysisId, jobId, values, files }) => {
			const analysis = await finalizeAnalysis(deps.db, analysisId, jobId, {
				results: values.results,
				files: files.map((file) => ({
					name: file.name,
					format: file.format,
					description: file.description,
					size: file.size,
					storageKey: file.storageKey,
				})),
			});

			deps.logger.info(
				{ jobId, analysisId, files: files.length },
				"finalized analysis",
			);

			return analysis;
		},
	});
}
