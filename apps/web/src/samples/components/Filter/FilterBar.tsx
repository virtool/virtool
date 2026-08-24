import { getWorkflowDisplayName } from "@app/utils";
import {
	FilterBar as BaseFilterBar,
	FilterChip,
	FilterGroup,
} from "@base/Filter";
import { PopoverContent } from "@base/Popover";
import { type DateFilter, getDateFilterLabel } from "@samples/dateFilter";
import { getHexColor } from "@samples/labels";
import {
	formatWorkflowFilter,
	getWorkflowFilterStateDisplayName,
	parseWorkflowFilters,
} from "@samples/utils";
import UserFilterGroup from "@users/components/UserFilterGroup";
import type { Label } from "@virtool/contracts";
import { CalendarDays, Search, Tag, Workflow } from "lucide-react";
import { lazy, Suspense } from "react";
import LabelFilterMenu from "./LabelFilterMenu";
import WorkflowFilterMenu from "./WorkflowFilterMenu";
import { workflowStateIcons } from "./workflowStateIcons";

// The range calendar and its date library are a large share of the samples
// route's chunk, and nothing downloads them until this popover is opened.
const DateFilterMenu = lazy(() => import("./DateFilterMenu"));
type FilterBarProps = {
	/** The days the list is narrowed to, if any. */
	dateFilter?: DateFilter;

	/** All available labels, used to resolve selected IDs to names and colors. */
	labels: Label[];

	/** Applies a date filter, or clears it when passed nothing. */
	onChangeDate: (filter: DateFilter | undefined) => void;

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
	dateFilter,
	labels,
	onChangeDate,
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
		<BaseFilterBar className="mb-3">
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
			<FilterGroup
				icon={<CalendarDays size={14} />}
				popover={
					<Suspense
						fallback={
							<PopoverContent className="p-3 text-gray-500">
								Loading calendar...
							</PopoverContent>
						}
					>
						<DateFilterMenu onChange={onChangeDate} value={dateFilter} />
					</Suspense>
				}
				title="Date"
			>
				{dateFilter && (
					<FilterChip
						onRemove={() => onChangeDate(undefined)}
						removeLabel="Clear date filter"
					>
						{getDateFilterLabel(dateFilter)}
					</FilterChip>
				)}
			</FilterGroup>
		</BaseFilterBar>
	);
}
