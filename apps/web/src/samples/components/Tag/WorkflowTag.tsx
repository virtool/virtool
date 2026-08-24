import Icon from "@base/Icon";
import Link from "@base/Link";
import type { WorkflowState } from "@virtool/contracts";
import { workflowStateIcons } from "../Filter/workflowStateIcons";
import { BaseWorkflowTag } from "./BaseWorkflowTag";

type SampleItemWorkflowTagProps = {
	displayName: string;
	sampleId: number;
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
	sampleId,
	workflowState,
}: SampleItemWorkflowTagProps) {
	const { icon } =
		workflowStateIcons[workflowState === "pending" ? "pending" : "ready"];

	return (
		<BaseWorkflowTag
			as={Link}
			className="hover:bg-purple-700"
			to={`/samples/${sampleId}/analyses`}
		>
			<Icon icon={icon} className="size-4" />
			<span>{displayName}</span>
		</BaseWorkflowTag>
	);
}
