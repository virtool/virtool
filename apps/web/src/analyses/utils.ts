// Analysis results arrive already shaped for rendering — every coverage, depth
// and aggregate figure is derived server-side from the raw alignments, in
// `@server/analyses/format`. Nothing is re-derived here.

const supportedWorkflows: string[] = ["pathoscope", "nuvs"];

export function checkSupportedWorkflow(workflow: string) {
	return supportedWorkflows.includes(workflow);
}
