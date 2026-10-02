import Field, { FieldLabel } from "@base/Field";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import { ChevronDown } from "lucide-react";

type LibraryTypeSelectorProps = {
	libraryType: string;
	onSelect: (libraryType: string) => void;
};

/**
 * Displays selections for library type in sample creation
 */
export default function LibraryTypeSelector({
	libraryType,
	onSelect,
}: LibraryTypeSelectorProps) {
	return (
		<Field className="mb-6">
			<FieldLabel>Library Type</FieldLabel>
			<Select value={libraryType} onValueChange={onSelect}>
				<SelectButton className="w-full" icon={ChevronDown} />
				<SelectContent>
					<SelectItem
						description="Search against whole genome references using normal reads."
						value="normal"
					>
						Normal
					</SelectItem>
					<SelectItem
						description="Search against whole genome references using sRNA reads."
						value="srna"
					>
						sRNA
					</SelectItem>
				</SelectContent>
			</Select>
		</Field>
	);
}
