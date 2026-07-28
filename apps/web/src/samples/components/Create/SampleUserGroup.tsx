import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import Select from "@base/Select";
import SelectButton from "@base/SelectButton";
import SelectContent from "@base/SelectContent";
import SelectItem from "@base/SelectItem";
import type { GroupMinimal } from "@virtool/contracts";
import { ChevronDown } from "lucide-react";

/**
 * Stands in for an unset group. Radix reserves the empty string, so the absence
 * of a group can't be modelled by the item's value directly.
 */
const noGroup = "none";

type SampleUserGroupProps = {
	selected: string;
	groups: GroupMinimal[];
	/** A callback function to handle the user group change */
	onChange: (value: string) => void;
};

/**
 * A dropdown showing the user groups and its options
 */
export default function SampleUserGroup({
	selected,
	groups,
	onChange,
}: SampleUserGroupProps) {
	return (
		<InputGroup>
			<InputLabel htmlFor="userGroups">User Group</InputLabel>
			<Select
				value={selected || noGroup}
				onValueChange={(value) => onChange(value === noGroup ? "" : value)}
			>
				<SelectButton className="w-full" icon={ChevronDown} id="userGroups" />
				<SelectContent>
					<SelectItem key={noGroup} value={noGroup}>
						None
					</SelectItem>
					{groups.map((group) => (
						<SelectItem key={group.id} value={String(group.id)}>
							{group.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</InputGroup>
	);
}
