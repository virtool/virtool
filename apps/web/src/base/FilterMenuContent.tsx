import type { ReactNode } from "react";
import DropdownMenuContent from "./DropdownMenuContent";
import DropdownMenuItem from "./DropdownMenuItem";
import DropdownMenuSeparator from "./DropdownMenuSeparator";

type FilterMenuContentProps = {
	/** The options the menu offers. */
	children: ReactNode;

	/** Deselects every option in the menu. */
	onClear: () => void;

	/** Whether the menu has an active filter to clear. */
	showClear: boolean;
};

/**
 * The menu a {@link FilterGroup} opens, with a clear action below its options.
 */
export default function FilterMenuContent({
	children,
	onClear,
	showClear,
}: FilterMenuContentProps) {
	return (
		<DropdownMenuContent className="w-64">
			{children}
			{showClear && (
				<>
					<DropdownMenuSeparator />
					<DropdownMenuItem color="blue" onSelect={onClear}>
						Clear
					</DropdownMenuItem>
				</>
			)}
		</DropdownMenuContent>
	);
}
