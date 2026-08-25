import { cn } from "@app/cn";
import Icon from "@base/Icon";
import type { WorkflowFilterState } from "@samples/utils";
import type { WorkflowState } from "@virtool/contracts";
import { workflowStateIcons } from "../Filter/workflowStateIcons";
import { BaseWorkflowTag } from "./BaseWorkflowTag";

type SampleItemWorkflowTagProps = {
	displayName: string;
	workflowState: WorkflowState;
};

const filterStates: Record<WorkflowState, WorkflowFilterState> = {
	complete: "ready",
	pending: "pending",
	none: "none",
	incompatible: "none",
};

const tagClassNames: Record<WorkflowFilterState, string> = {
	ready: "bg-green-50 text-green-800 group-hover:bg-green-100",
	pending: "bg-gray-100 text-gray-700 group-hover:bg-gray-200",
	none: "bg-gray-100 text-gray-600 group-hover:bg-gray-200",
};

/**
 * An inline segment displaying the current state of a single workflow.
 *
 * @param displayName - the display name of the workflow
 * @param workflowState - current state of the workflow
 * @returns A tag displaying the state of a workflow
 */
export default function WorkflowTag({
	displayName,
	workflowState,
}: SampleItemWorkflowTagProps) {
	const state = filterStates[workflowState];
	const { className, icon } = workflowStateIcons[state];

	return (
		<BaseWorkflowTag className={tagClassNames[state]}>
			<Icon icon={icon} className={cn("size-4", className)} />
			<span>{displayName}</span>
		</BaseWorkflowTag>
	);
}
