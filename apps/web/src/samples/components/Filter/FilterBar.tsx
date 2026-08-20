import { getWorkflowDisplayName } from "@app/utils";
import BaseFilterBar from "@base/FilterBar";
import FilterChip from "@base/FilterChip";
import FilterGroup from "@base/FilterGroup";
import { getHexColor } from "@samples/labels";
import {
	formatWorkflowFilter,
	getWorkflowFilterStateDisplayName,
	parseWorkflowFilters,
} from "@samples/utils";
import UserFilterGroup from "@users/components/UserFilterGroup";
import type { Label } from "@virtool/contracts";
import { Search, Tag, Workflow } from "lucide-react";
import LabelFilterMenu from "./LabelFilterMenu";
import WorkflowFilterMenu from "./WorkflowFilterMenu";
import { workflowStateIcons } from "./workflowStateIcons";

type FilterBarProps = {
	/** All available labels, used to resolve selected IDs to names and colors. */
	labels: Label[];

	/** Deselects every label. */
	onClearLabels: () => void;

	/** Clears the search term. */
	onClearTerm: () => void;

	/** Deselects every user. */
	onClearUsers: () => void;

	/** Deselects every workflow state. */
	onClearWorkflows: () => void;

	/** Toggles a single label. */
	onToggleLabel: (labelId: number) => void;

	/** Toggles a single user. */
	onToggleUser: (userId: number) => void;

	/** Toggles a single ``workflow:state`` filter. */
	onToggleWorkflow: (value: string) => void;

	/** Selected label IDs. */
	selectedLabels: number[];

	/** The ids of the selected users. */
	selectedUsers: number[];

	/** Selected ``workflow:state`` filters. */
	selectedWorkflows: string[];

	/** The active search term. */
	term: string;
};

/**
 * A row of filter dropdowns, each showing chips for its active filters
 */
export default function FilterBar({
	labels,
	onClearLabels,
	onClearTerm,
	onClearUsers,
	onClearWorkflows,
	onToggleLabel,
	onToggleUser,
	onToggleWorkflow,
	selectedLabels,
	selectedUsers,
	selectedWorkflows,
	term,
}: FilterBarProps) {
	const selected = labels.filter((label) => selectedLabels.includes(label.id));
	const workflows = parseWorkflowFilters(selectedWorkflows);

	return (
		<BaseFilterBar>
			{term && (
				<FilterGroup icon={<Search size={14} />} title="Search">
					<FilterChip onRemove={onClearTerm} removeLabel="Clear search term">
						{term}
					</FilterChip>
				</FilterGroup>
			)}
			<UserFilterGroup
				onClear={onClearUsers}
				onToggle={onToggleUser}
				selected={selectedUsers}
			/>
			<FilterGroup
				icon={<Tag size={14} />}
				menu={
					<LabelFilterMenu
						labels={labels}
						onClear={onClearLabels}
						onToggle={onToggleLabel}
						selected={selectedLabels}
					/>
				}
				title="Labels"
			>
				{selected.map((label) => (
					<FilterChip
						key={label.id}
						onRemove={() => onToggleLabel(label.id)}
						removeLabel={`Remove ${label.name} label filter`}
					>
						<span
							className="size-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: getHexColor(label.color) }}
						/>
						{label.name}
					</FilterChip>
				))}
			</FilterGroup>
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
				{workflows.map(({ state, workflow }) => {
					const workflowName = getWorkflowDisplayName(workflow);
					const stateName = getWorkflowFilterStateDisplayName(state);
					const { className, icon: StateIcon } = workflowStateIcons[state];

					return (
						<FilterChip
							key={formatWorkflowFilter({ state, workflow })}
							onRemove={() =>
								onToggleWorkflow(formatWorkflowFilter({ state, workflow }))
							}
							removeLabel={`Remove ${workflowName} ${stateName} filter`}
						>
							{workflowName}
							<StateIcon className={className} size={14} />
						</FilterChip>
					);
				})}
			</FilterGroup>
		</BaseFilterBar>
	);
}
