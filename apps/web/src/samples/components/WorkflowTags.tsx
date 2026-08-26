import { cn } from "@app/cn";
import { getWorkflowDisplayName } from "@app/utils";
import Icon from "@base/Icon";
import Link from "@base/Link";
import type { WorkflowFilterState } from "@samples/utils";
import type { SampleWorkflows, WorkflowState } from "@virtool/contracts";
import { workflowStateIcons } from "./Filter/workflowStateIcons";

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

type WorkflowTagProps = {
	displayName: string;
	workflowState: WorkflowState;
};

/**
 * An inline segment displaying the current state of a single workflow.
 *
 * @param displayName - the display name of the workflow
 * @param workflowState - current state of the workflow
 * @returns A tag displaying the state of a workflow
 */
function WorkflowTag({ displayName, workflowState }: WorkflowTagProps) {
	const state = filterStates[workflowState];
	const { className, icon } = workflowStateIcons[state];

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 text-sm font-medium px-2 py-1.5",
				"first:rounded-l-sm last:rounded-r-sm",
				"[&_svg]:leading-[inherit]",
				tagClassNames[state],
			)}
		>
			<Icon icon={icon} className={cn("size-4", className)} />
			<span>{displayName}</span>
		</div>
	);
}

type WorkflowTagsProps = {
	id: number;
	workflows: SampleWorkflows;
};

/**
 * Workflow tags for a sample item
 *
 * The tags show the state of every analysis workflow associated with the sample.
 *
 *
 * @param id - the sample's id
 * @param workflows - the workflows object for the sample
 * @returns The workflow tags for a sample.
 */
export default function WorkflowTags({ id, workflows }: WorkflowTagsProps) {
	return (
		<Link
			className="group flex items-stretch"
			to="/samples/$sampleId/analyses"
			params={{ sampleId: String(id) }}
		>
			{Object.entries(workflows).map(([key, value]) => (
				<WorkflowTag
					key={key}
					displayName={getWorkflowDisplayName(key)}
					workflowState={value}
				/>
			))}
		</Link>
	);
}
