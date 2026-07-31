import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ButtonGroupProps = {
	/** Names the group as a whole, for a set whose purpose its members do not say */
	"aria-label"?: string;

	/** The buttons to join, in the order they are shown */
	children: ReactNode;

	className?: string;
};

/**
 * Joins related buttons into a single control, rounding only the outer corners.
 *
 * Seams are drawn with `:first-child` / `:last-child`, so a member has to be a
 * DOM child — a wrapper that renders an element of its own becomes the member
 * instead. Each member is its own tab stop; reach for a Radix `Toolbar` if a
 * group grows long enough to want one.
 */
export default function ButtonGroup({
	"aria-label": ariaLabel,
	children,
	className,
}: ButtonGroupProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls, not a set of related buttons
		<div
			aria-label={ariaLabel}
			className={cn(
				"inline-flex",
				"items-stretch",
				"[&>*:not(:first-child)]:rounded-l-none",
				"[&>*:not(:last-child)]:rounded-r-none",
				// Our buttons are solid fills, so adjacent ones need a seam to read as
				// two. Translucent, to hold up on a member of any colour.
				"[&>*:not(:first-child)]:border-l",
				"[&>*:not(:first-child)]:border-black/10",
				// Siblings paint in order, so a member's focus ring would otherwise be
				// painted over by its neighbour.
				"[&>*:focus-visible]:relative",
				"[&>*:focus-visible]:z-10",
				className,
			)}
			role="group"
		>
			{children}
		</div>
	);
}
