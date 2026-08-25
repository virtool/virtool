import { getWorkflowDisplayName } from "@app/utils";
import Link from "@base/Link";
import type { SampleWorkflows } from "@virtool/contracts";
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
