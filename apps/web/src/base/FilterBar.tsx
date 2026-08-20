import type { ReactNode } from "react";

type FilterBarProps = {
	/** The filter groups, each showing chips for its active filters. */
	children: ReactNode;
};

/**
 * The row of filter dropdowns above a list view.
 */
export default function FilterBar({ children }: FilterBarProps) {
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
			{children}
		</div>
	);
}
