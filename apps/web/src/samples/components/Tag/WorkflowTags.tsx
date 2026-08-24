import { getWorkflowDisplayName } from "@app/utils";
import Link from "@base/Link";
import type { SampleWorkflows } from "@virtool/contracts";
import { BaseWorkflowTag } from "./BaseWorkflowTag";
import WorkflowTag from "./WorkflowTag";

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
	const workflowTags = Object.entries(workflows)
		.filter(([, value]) => value === "complete" || value === "pending")
		.map(([key, value]) => (
			<WorkflowTag
				key={key}
				displayName={getWorkflowDisplayName(key)}
				sampleId={id}
				workflowState={value}
			/>
		));
	return (
		<div className="flex items-stretch">
			{!workflowTags.length && (
				<BaseWorkflowTag
					as={Link}
					className="bg-purple-50 border border-purple-400 text-purple-900 hover:bg-purple-100"
					to={`/samples/${id}/analyses`}
				>
					No Analyses
				</BaseWorkflowTag>
			)}
			{workflowTags}
		</div>
	);
}
