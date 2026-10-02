import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Props for a `FieldLegend`. */
export type FieldLegendProps = ComponentProps<"legend"> & {
	/** Styles the legend like a `FieldLabel` instead of a section heading. */
	variant?: "legend" | "label";
};

/** The caption for a `FieldSet`. */
export default function FieldLegend({
	className,
	variant = "legend",
	...props
}: FieldLegendProps) {
	return (
		<legend
			className={cn(
				"mb-2 p-0",
				variant === "legend" ? "text-lg font-medium" : "font-medium",
				className,
			)}
			data-slot="field-legend"
			data-variant={variant}
			{...props}
		/>
	);
}
