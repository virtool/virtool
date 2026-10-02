import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Props for a `FieldSet`. */
export type FieldSetProps = ComponentProps<"fieldset">;

/**
 * Groups several related controls under one `FieldLegend`.
 *
 * Don't wrap a single-control `Field` in a `FieldSet`; a screen reader would
 * announce both the legend and the label. Set `disabled` to lock every control
 * inside, such as while a form submits.
 */
export default function FieldSet({ className, ...props }: FieldSetProps) {
	return (
		<fieldset
			className={cn("m-0 mb-4 min-w-0 border-0 p-0", className)}
			data-slot="field-set"
			{...props}
		/>
	);
}
