import { SelectBox, SelectBoxItem } from "@base/Select";

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
		<SelectBox
			className="grid-cols-2 mb-6"
			label="Library Type"
			onValueChange={onSelect}
			value={libraryType}
		>
			<SelectBoxItem value="normal">
				<div>Normal</div>
				<span>Search against whole genome references using normal reads.</span>
			</SelectBoxItem>
			<SelectBoxItem value="srna">
				<div>sRNA</div>
				<span>Search against whole genome references using sRNA reads</span>
			</SelectBoxItem>
		</SelectBox>
	);
}
