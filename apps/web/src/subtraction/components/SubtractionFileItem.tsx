import Attribution from "@base/Attribution";
import SelectBoxGroupSection from "@base/SelectBoxGroupSection";
import type { UserNested } from "@virtool/contracts";

type SubtractionFileItemProps = {
	/** Whether the file is selected */
	active: boolean;
	/** Error message to be displayed */
	error: string;
	/** Whether the option is the listbox's active descendant */
	highlighted: boolean;
	/** The unique identifier */
	id: number;
	/** The option's DOM id, referenced by the listbox's `aria-activedescendant` */
	optionId: string;
	/** The name of the file */
	name: string;
	/** A callback function to handle file selection */
	onClick: (selected: number[]) => void;
	/** When the file was uploaded, or null for a row that predates the column */
	uploadedAt: Date | null;
	/** The user who created the file, or null for a retrieved file */
	user: UserNested | null;
};

/**
 * A condensed file for use in a list of subtraction uploads
 */
export function SubtractionFileItem({
	active,
	highlighted,
	id,
	optionId,
	name,
	onClick,
	uploadedAt,
	user,
}: SubtractionFileItemProps) {
	return (
		<SelectBoxGroupSection
			active={active}
			className="flex justify-between"
			highlighted={highlighted}
			id={optionId}
			onClick={() => onClick([id])}
		>
			<strong>{name}</strong>
			<Attribution user={user?.handle} time={uploadedAt} />
		</SelectBoxGroupSection>
	);
}
