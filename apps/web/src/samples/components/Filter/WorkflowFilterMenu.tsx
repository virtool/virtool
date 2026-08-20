import { getWorkflowDisplayName } from "@app/utils";
import DropdownMenuGroup from "@base/DropdownMenuGroup";
import DropdownMenuLabel from "@base/DropdownMenuLabel";
import DropdownMenuSeparator from "@base/DropdownMenuSeparator";
import FilterMenuCheckboxItem from "@base/FilterMenuCheckboxItem";
import FilterMenuContent from "@base/FilterMenuContent";
import {
	filterableWorkflows,
	formatWorkflowFilter,
	getWorkflowFilterStateDisplayName,
	workflowFilterStates,
} from "@samples/utils";
import { Fragment } from "react";
import { workflowStateIcons } from "./workflowStateIcons";

type WorkflowFilterMenuProps = {
	/** Deselects every workflow state. */
	onClear: () => void;

	/** Toggles a single ``workflow:state`` filter. */
	onToggle: (value: string) => void;

	/** Selected ``workflow:state`` filters. */
	selected: string[];
};

/**
 * A dropdown menu for selecting the workflow states that samples are filtered by
 */
export default function WorkflowFilterMenu({
	onClear,
	onToggle,
	selected,
}: WorkflowFilterMenuProps) {
	return (
		<FilterMenuContent onClear={onClear} showClear={selected.length > 0}>
			{filterableWorkflows.map((workflow, index) => {
				const workflowName = getWorkflowDisplayName(workflow);
				const labelId = `workflow-filter-${workflow}`;

				return (
					<Fragment key={workflow}>
						{index > 0 && <DropdownMenuSeparator />}
						<DropdownMenuGroup aria-labelledby={labelId}>
							<DropdownMenuLabel id={labelId}>{workflowName}</DropdownMenuLabel>
							{workflowFilterStates.map((state) => {
								const value = formatWorkflowFilter({ state, workflow });
								const stateName = getWorkflowFilterStateDisplayName(state);
								const { className, icon: StateIcon } =
									workflowStateIcons[state];

								return (
									<FilterMenuCheckboxItem
										aria-label={`${workflowName} ${stateName}`}
										checked={selected.includes(value)}
										key={state}
										onCheckedChange={() => onToggle(value)}
									>
										<StateIcon className={className} size={14} />
										{stateName}
									</FilterMenuCheckboxItem>
								);
							})}
						</DropdownMenuGroup>
					</Fragment>
				);
			})}
		</FilterMenuContent>
	);
}
