import { cn } from "@app/cn";
import type { ComponentProps } from "react";
import { useFieldContext } from "./FieldContext";

const variantClasses = {
	default: "font-medium mb-2 inline-block",
	row: "flex cursor-pointer font-normal",
	card: "flex cursor-pointer font-normal rounded-md border border-gray-300 p-4 has-[[data-state=checked]]:border-blue-600 has-[[data-state=checked]]:bg-blue-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500/50",
};

/** Props for a `FieldLabel`. */
export type FieldLabelProps = ComponentProps<"label"> & {
	/**
	 * Set `row` or `card` when the label wraps a whole horizontal `Field`, so
	 * that a click anywhere in it toggles the control. A `card` also has a
	 * border and highlights when its control is checked. Put a `FieldTitle` in
	 * the `Field` to name the control.
	 */
	variant?: keyof typeof variantClasses;
};

/** The label for the control in the surrounding `Field`. */
export default function FieldLabel({
	className,
	htmlFor,
	variant = "default",
	...props
}: FieldLabelProps) {
	const field = useFieldContext();

	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor comes from the surrounding Field, or the label wraps its control
		<label
			className={cn(
				variantClasses[variant],
				"group-data-[disabled=true]/field:opacity-50",
				className,
			)}
			data-slot="field-label"
			data-variant={variant}
			htmlFor={htmlFor ?? field?.controlId}
			{...props}
		/>
	);
}
