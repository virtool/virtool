import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import {
	inputBaseClasses,
	inputFocusClasses,
	inputHeightClass,
	inputInvalidClasses,
} from "@base/styles";
import type { ComponentProps } from "react";

/** Props for the shared single-line text input. Accepts any native input attribute. */
export type InputProps = ComponentProps<"input">;

/**
 * A single-line text input. Inside a `Field`, it takes its `id` and ARIA
 * connections from the field.
 */
export default function Input({ className, ...props }: InputProps) {
	const fieldProps = useFieldControl(props);

	return (
		<input
			className={cn(
				inputBaseClasses,
				inputHeightClass,
				inputFocusClasses,
				inputInvalidClasses,
				"read-only:bg-gray-100",
				className,
			)}
			data-slot="input"
			{...props}
			{...fieldProps}
		/>
	);
}
