import Icon from "@base/Icon";
import { getLibraryTypeDisplayName } from "@samples/utils";
import type { LibraryType } from "@virtool/contracts";
import { Dna } from "lucide-react";
import { BaseSampleLabel } from "./BaseSampleLabel";

type SampleLibraryTypeLabelProps = {
	/** The samples library type */
	libraryType: LibraryType;
};

/**
 * Displays the library type associated with the sample
 */
export default function SampleLibraryTypeLabel({
	libraryType,
}: SampleLibraryTypeLabelProps) {
	return (
		<BaseSampleLabel variant="library">
			<Icon icon={Dna} />
			<span>{getLibraryTypeDisplayName(libraryType)}</span>
		</BaseSampleLabel>
	);
}
