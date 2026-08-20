// Analysis results arrive already shaped for rendering — every coverage, depth
// and aggregate figure is derived server-side from the raw alignments, in
// `@server/analyses/format`. Nothing is re-derived here.

import type { AnalysisWorkflow } from "@virtool/contracts";

/** The workflows this client can view results for, and filter a list by. */
export const supportedWorkflows: AnalysisWorkflow[] = ["pathoscope", "nuvs"];

export function checkSupportedWorkflow(workflow: string) {
	return supportedWorkflows.some((supported) => supported === workflow);
}
