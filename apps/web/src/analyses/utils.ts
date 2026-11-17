// Analysis results arrive already shaped for rendering — every coverage, depth
// and aggregate figure is derived server-side from the raw alignments, in
// `@server/analyses/format`. Nothing is re-derived here.

import {
	type AnalysisMinimal,
	AnalysisWorkflow,
	isJobStateTerminal,
	type JobState,
} from "@virtool/contracts";

/** The workflows this client can view results for, and filter a list by. */
export const supportedWorkflows = AnalysisWorkflow.options;

export function checkSupportedWorkflow(workflow: string) {
	return supportedWorkflows.some((supported) => supported === workflow);
}

/**
 * The label for an analysis's finalizing workflow version.
 *
 * An unready analysis has no version yet because it is not finalized. For a
 * ready analysis, two absences read differently: `null` is a version that was
 * never captured — a legacy analysis finalized before the version was recorded —
 * while the literal `"UNKNOWN"` is a version that was captured from an image
 * that carried no version of its own.
 */
export function getWorkflowVersionLabel({
	ready,
	workflowVersion: version,
}: Pick<AnalysisMinimal, "ready" | "workflowVersion">): string {
	if (!ready) {
		return "Pending";
	}

	if (version === null) {
		return "not recorded";
	}

	if (version === "UNKNOWN") {
		return "Unknown";
	}

	return version;
}

/**
 * Whether an analysis can be removed, given its embedded job and the job as
 * last fetched, if it has been.
 *
 * The same predicate `deleteAnalysis` applies, and deliberately not `ready`.
 * It reads both ways: an unready analysis whose pod was OOM-killed or evicted
 * stays removable rather than stranding the user, and a finished analysis
 * whose job has not been marked terminal yet does not advertise a button the
 * server would answer with a 409.
 */
export function checkCanRemoveAnalysis(
	analysis: Pick<AnalysisMinimal, "job">,
	job?: { state: JobState },
): boolean {
	const state = job?.state ?? analysis.job?.state;

	return state === undefined || isJobStateTerminal(state);
}
