import { cn } from "@app/cn";
import type { ReactNode } from "react";

type AnalysisValueProps = {
	/** Extra classes for the column, for a value that needs a wider one */
	className?: string;

	color: "blue" | "gray" | "green" | "red";

	/** Whether the label is shown, or left for assistive technology only */
	hideLabel?: boolean;

	label: ReactNode;
	value: ReactNode;
};

/** One labelled figure in a column of them. */
export default function AnalysisValue({
	className,
	color,
	hideLabel = false,
	label,
	value,
}: AnalysisValueProps) {
	// Positioned so a hidden label has a containing block. `sr-only` is
	// `position: absolute` with no offsets, and the scrolling content container is
	// not positioned — without this the label resolves against the initial
	// containing block, at a static position thousands of pixels down a long list,
	// and grows the document until it sprouts a scrollbar of its own beside the
	// shell's.
	return (
		<div className={cn("flex flex-col relative w-22", className)}>
			<span
				className={cn(
					{
						"text-blue-700": color === "blue",
						"text-gray-700": color === "gray",
						"text-green-700": color === "green",
						"text-red-700": color === "red",
					},
					"font-semibold",
					"truncate",
				)}
			>
				{value}
			</span>
			<small
				className={cn(
					"font-medium mt-1.5 text-gray-500",
					hideLabel && "sr-only",
				)}
			>
				{label}
			</small>
		</div>
	);
}
