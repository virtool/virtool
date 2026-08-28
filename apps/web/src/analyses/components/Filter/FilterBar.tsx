import { getWorkflowDisplayName } from "@app/utils";
import {
	FilterBar as BaseFilterBar,
	FilterChip,
	FilterGroup,
} from "@base/Filter";
import UserFilterGroup from "@users/components/UserFilterGroup";
import type { AnalysisWorkflow } from "@virtool/contracts";
import { Workflow } from "lucide-react";
import WorkflowFilterMenu from "./WorkflowFilterMenu";

type FilterBarProps = {
	/** Deselects every user. */
	onClearUsers: () => void;

	/** Deselects every workflow. */
	onClearWorkflows: () => void;

	/** Toggles a single user. */
	onToggleUser: (userId: number) => void;

	/** Toggles a single workflow. */
	onToggleWorkflow: (workflow: AnalysisWorkflow) => void;

	/** The ids of the selected users. */
	selectedUsers: number[];

	/** The selected workflows. */
	selectedWorkflows: AnalysisWorkflow[];
};

/**
 * The filters narrowing a sample's analyses, each showing chips for its active
 * filters
 */
export default function FilterBar({
	onClearUsers,
	onClearWorkflows,
	onToggleUser,
	onToggleWorkflow,
	selectedUsers,
	selectedWorkflows,
}: FilterBarProps) {
	return (
		<BaseFilterBar label="Filters">
			<FilterGroup
				icon={<Workflow size={14} />}
				menu={
					<WorkflowFilterMenu
						onClear={onClearWorkflows}
						onToggle={onToggleWorkflow}
						selected={selectedWorkflows}
					/>
				}
				title="Workflows"
			>
				{selectedWorkflows.map((workflow) => (
					<FilterChip
						key={workflow}
						onRemove={() => onToggleWorkflow(workflow)}
						removeLabel={`Remove ${getWorkflowDisplayName(workflow)} workflow filter`}
					>
						{getWorkflowDisplayName(workflow)}
					</FilterChip>
				))}
			</FilterGroup>
			<UserFilterGroup
				onClear={onClearUsers}
				onToggle={onToggleUser}
				selected={selectedUsers}
			/>
		</BaseFilterBar>
	);
}
