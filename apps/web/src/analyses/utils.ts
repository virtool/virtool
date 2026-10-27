// Analysis results arrive already shaped for rendering — every coverage, depth
// and aggregate figure is derived server-side from the raw alignments, in
// `@server/analyses/format`. Nothing is re-derived here.

import { type AnalysisMinimal, AnalysisWorkflow } from "@virtool/contracts";

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
