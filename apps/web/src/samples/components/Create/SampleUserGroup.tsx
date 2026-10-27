import Field, { FieldLabel } from "@base/Field";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
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
		<Field>
			<FieldLabel>User Group</FieldLabel>
			<Select
				value={selected || noGroup}
				onValueChange={(value) => onChange(value === noGroup ? "" : value)}
			>
				<SelectButton className="w-full" icon={ChevronDown} />
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
		</Field>
	);
}
