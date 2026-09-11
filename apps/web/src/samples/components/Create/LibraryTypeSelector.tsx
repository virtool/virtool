import { InputGroup, InputLabel } from "@base/Input";
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
		<InputGroup className="mb-6">
			<InputLabel htmlFor="libraryType">Library Type</InputLabel>
			<Select value={libraryType} onValueChange={onSelect}>
				<SelectButton className="w-full" icon={ChevronDown} id="libraryType" />
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
		</InputGroup>
	);
}
