import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import type { ComponentProps } from "react";
import {
	inputBaseClasses,
	inputFocusClasses,
	inputInvalidClasses,
} from "./styles";

/** Props for the shared multi-line text input. Accepts any native textarea attribute. */
export type TextAreaProps = ComponentProps<"textarea">;

/**
 * A multi-line text input that grows with its content. Inside a `Field`, it
 * takes its `id`, `aria-invalid`, and `aria-describedby` from the field.
 */
export default function TextArea({
	className,
	id,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	...props
}: TextAreaProps) {
	const fieldProps = useFieldControl({
		id,
		"aria-describedby": ariaDescribedBy,
		"aria-invalid": ariaInvalid,
	});

	return (
		<textarea
			className={cn(
				inputBaseClasses,
				inputFocusClasses,
				inputInvalidClasses,
				"read-only:bg-gray-100",
				"field-sizing-content min-h-56 resize-y",
				className,
			)}
			data-slot="textarea"
			{...fieldProps}
			{...props}
		/>
	);
}
