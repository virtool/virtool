import { cn } from "@app/cn";
import type { ReactNode } from "react";

type FilterBarProps = {
	/** An accessible name for the bar, distinguishing its controls from the list. */
	label: string;

	/** The filter groups, each showing chips for its active filters. */
	children: ReactNode;

	/** Spacing for where the bar sits, which is the caller's to decide. */
	className?: string;
};

/**
 * A row of filter dropdowns for a list view.
 */
export default function FilterBar({
	children,
	className,
	label,
}: FilterBarProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset would impose its own layout and demand a legend; this is a labelled group of controls, not a form section.
		<div
			aria-label={label}
			className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}
			role="group"
		>
			{children}
		</div>
	);
}
