import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import { ChevronDown } from "lucide-react";

/**
 * Stands in for the "None" rights value. Radix reserves the empty string, so the
 * absence of rights can't be modelled by the item's value directly.
 */
const noRights = "none";

const rights = [
	{ label: "None", value: noRights },
	{ label: "Read", value: "r" },
	{ label: "Read & write", value: "rw" },
];

type RightsSelectProps = {
	/** Associates the trigger with its label via `htmlFor`. */
	id: string;
	/** The current rights string: `""`, `"r"`, or `"rw"`. */
	value: string;
	/** Called with the new rights string when a value is selected. */
	onChange: (value: string) => void;
};

/**
 * A dropdown for choosing read/write rights, mapping the "None" option to an
 * empty string.
 */
export default function RightsSelect({
	id,
	value,
	onChange,
}: RightsSelectProps) {
	return (
		<Select
			value={value || noRights}
			onValueChange={(value) => onChange(value === noRights ? "" : value)}
		>
			<SelectButton className="w-full normal-case" icon={ChevronDown} id={id} />
			<SelectContent>
				{rights.map((entry) => (
					<SelectItem
						className="normal-case"
						key={entry.value}
						value={entry.value}
					>
						{entry.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
