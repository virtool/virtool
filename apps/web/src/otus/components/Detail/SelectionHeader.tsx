import { BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import type { ReactNode } from "react";

type SelectionHeaderProps = {
	/** Names the select-all checkbox */
	ariaLabel: string;

	/** Whether every, some, or no row is selected */
	checked: boolean | "indeterminate";

	/** Content after the checkbox, such as column headings */
	children?: ReactNode;

	/** Called to select or deselect every row */
	onSelectAll: () => void;

	/** The count shown beside the checkbox */
	summary: string;
};

/**
 * The first row of a selectable list: a select-all checkbox and a count of the
 * rows, and of the selection once there is one.
 */
export default function SelectionHeader({
	ariaLabel,
	checked,
	children,
	onSelectAll,
	summary,
}: SelectionHeaderProps) {
	return (
		<BoxGroupSection className="flex items-center gap-4 bg-gray-50 px-6 py-2 text-sm font-medium text-gray-700">
			<Checkbox ariaLabel={ariaLabel} checked={checked} onClick={onSelectAll} />
			<span className="shrink-0">{summary}</span>
			{children}
		</BoxGroupSection>
	);
}
