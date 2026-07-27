import type { WorkflowName } from "@virtool/contracts";

export type workflow = {
	description: string;
	id: WorkflowName;
	name: string;
};

export const pathoscopeWorkflow: workflow = {
	description: "Find known viruses.",
	id: "pathoscope",
	name: "Pathoscope",
};

export const nuvsWorkflow: workflow = {
	description: "Find novel viruses.",
	id: "nuvs",
	name: "NuVs",
};

export const workflows = [pathoscopeWorkflow, nuvsWorkflow] as workflow[];

export function getCompatibleWorkflows(hasHmm: boolean): workflow[] {
	return workflows.filter((workflow) => {
		if (workflow.id === "nuvs") {
			return hasHmm;
		}

		return true;
	});
}
