import { cn } from "@app/cn";
import { getWorkflowDisplayName } from "@app/utils";
import Dropdown from "@base/Dropdown";
import DropdownMenuTrigger from "@base/DropdownMenuTrigger";
import { getHexColor } from "@samples/labels";
import {
	formatWorkflowFilter,
	getWorkflowFilterStateDisplayName,
	parseWorkflowFilters,
} from "@samples/utils";
import { useListUsers } from "@users/queries";
import type { Label } from "@virtool/contracts";
import { Search, Tag, Users, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import LabelFilterMenu from "./LabelFilterMenu";
import UserFilterMenu from "./UserFilterMenu";
import WorkflowFilterMenu from "./WorkflowFilterMenu";
import { workflowStateIcons } from "./workflowStateIcons";

const titleClassName =
	"flex items-center gap-1.5 px-2 py-0.5 font-medium text-gray-500";

type FilterChipProps = {
	children: ReactNode;
	onRemove: () => void;
	removeLabel: string;
};

function FilterChip({ children, onRemove, removeLabel }: FilterChipProps) {
	return (
		<button
			aria-label={removeLabel}
			className="inline-flex cursor-pointer items-center gap-1.5 border-gray-300 border-l px-2 py-0.5 hover:bg-gray-100"
			onClick={onRemove}
			type="button"
		>
			{children}
		</button>
	);
}

type FilterGroupProps = {
	/** Chips for the filters that are active in this group. */
	children?: ReactNode;

	/** An icon shown left of the group title. */
	icon: ReactNode;

	/** The menu opened by the group title. Omit to make the title inert. */
	menu?: ReactNode;

	/** The group title, which triggers ``menu``. */
	title: string;
};

function FilterGroup({ children, icon, menu, title }: FilterGroupProps) {
	const shell = (
		<div className="flex items-stretch overflow-hidden rounded-md border border-gray-300 bg-white text-sm">
			{menu ? (
				<DropdownMenuTrigger
					className={cn(titleClassName, "hover:bg-gray-100")}
				>
					{icon}
					{title}
				</DropdownMenuTrigger>
			) : (
				<span className={titleClassName}>
					{icon}
					{title}
				</span>
			)}
			{children}
		</div>
	);

	if (!menu) {
		return shell;
	}

	return (
		// Non-modal so the group's chips stay visible and clickable while its menu
		// is open. A modal menu would `aria-hidden` them along with the rest of the
		// page.
		<Dropdown modal={false}>
			{shell}
			{menu}
		</Dropdown>
	);
}

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
	// Shares a query key with the menu's own list, so this resolves from the cache
	// rather than issuing a second request.
	const { data: users, isPending: isPendingUsers } = useListUsers();

	const selected = labels.filter((label) => selectedLabels.includes(label.id));
	const workflows = parseWorkflowFilters(selectedWorkflows);
	const handlesById = new Map(users?.map((user) => [user.id, user.handle]));

	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
			{term && (
				<FilterGroup icon={<Search size={14} />} title="Search">
					<FilterChip onRemove={onClearTerm} removeLabel="Clear search term">
						{term}
					</FilterChip>
				</FilterGroup>
			)}
			<FilterGroup
				icon={<Users size={14} />}
				menu={
					<UserFilterMenu
						onClear={onClearUsers}
						onToggle={onToggleUser}
						selected={selectedUsers}
					/>
				}
				title="Users"
			>
				{selectedUsers.map((userId) => {
					const handle = handlesById.get(userId);

					return (
						<FilterChip
							key={userId}
							onRemove={() => onToggleUser(userId)}
							removeLabel={`Remove ${handle ?? `User ${userId}`} user filter`}
						>
							{handle ??
								(isPendingUsers ? (
									<span className="h-3 w-16 animate-pulse rounded-sm bg-gray-200" />
								) : (
									`User ${userId}`
								))}
						</FilterChip>
					);
				})}
			</FilterGroup>
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
		</div>
	);
}
