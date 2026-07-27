import Icon from "@base/Icon";
import type { WorkflowState } from "@virtool/contracts";
import { workflowStateIcons } from "../Filter/workflowStateIcons";
import { BaseWorkflowTag } from "./BaseWorkflowTag";

type SampleItemWorkflowTagProps = {
	displayName: string;
	workflowState: WorkflowState;
};

/**
 * An inline tag for displaying the current state of a workflow.
 *
 * @param displayName - the display name of the workflow
 * @param workflowState - current state of the workflow
 * @returns A tag displaying the state of a workflow
 */
export default function WorkflowTag({
	displayName,
	workflowState,
}: SampleItemWorkflowTagProps) {
	const { icon } =
		workflowStateIcons[workflowState === "pending" ? "pending" : "ready"];

	return (
		<BaseWorkflowTag>
			<Icon icon={icon} className="size-4" />
			<span>{displayName}</span>
		</BaseWorkflowTag>
	);
}
