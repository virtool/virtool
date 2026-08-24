import { supportedWorkflows } from "@analyses/utils";
import { getWorkflowDisplayName } from "@app/utils";
import { FilterMenuCheckboxItem, FilterMenuContent } from "@base/Filter";
import type { AnalysisWorkflow } from "@virtool/contracts";

type WorkflowFilterMenuProps = {
	/** Deselects every workflow. */
	onClear: () => void;

	/** Toggles a single workflow. */
	onToggle: (workflow: AnalysisWorkflow) => void;

	/** The selected workflows. */
	selected: AnalysisWorkflow[];
};

/**
 * A dropdown menu for selecting the workflows that analyses are filtered by
 */
export default function WorkflowFilterMenu({
	onClear,
	onToggle,
	selected,
}: WorkflowFilterMenuProps) {
	return (
		<FilterMenuContent onClear={onClear} showClear={selected.length > 0}>
			{supportedWorkflows.map((workflow) => (
				<FilterMenuCheckboxItem
					checked={selected.includes(workflow)}
					key={workflow}
					onCheckedChange={() => onToggle(workflow)}
				>
					<span className="flex-grow truncate">
						{getWorkflowDisplayName(workflow)}
					</span>
				</FilterMenuCheckboxItem>
			))}
		</FilterMenuContent>
	);
}
