import { cn } from "@app/cn";
import type { ReactNode } from "react";

type FilterBarProps = {
	/** The filter groups, each showing chips for its active filters. */
	children: ReactNode;

	/** Spacing for where the bar sits, which is the caller's to decide. */
	className?: string;
};

/**
 * A row of filter dropdowns for a list view.
 */
export default function FilterBar({ children, className }: FilterBarProps) {
	return (
		<div
			className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}
		>
			{children}
		</div>
	);
}
