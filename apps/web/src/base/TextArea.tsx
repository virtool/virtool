import { cn } from "@app/cn";
import { useIsInvalid } from "@base/Input";
import type { ComponentProps } from "react";
import {
	inputBaseClasses,
	inputFocusClasses,
	inputInvalidClasses,
} from "./styles";

/** Props for the shared multi-line text input. Accepts any native textarea attribute. */
export type TextAreaProps = ComponentProps<"textarea"> & {
	/** Marks the textarea invalid, turning its border and focus ring red. Falls back to the error on a surrounding `InputGroup`. */
	error?: string;
};

export default function TextArea({
	className,
	error,
	...props
}: TextAreaProps) {
	const invalid = useIsInvalid(error);

	return (
		<textarea
			aria-invalid={invalid || undefined}
			className={cn(
				inputBaseClasses,
				inputFocusClasses,
				inputInvalidClasses,
				"read-only:bg-gray-100",
				"h-56 resize-y overflow-y-scroll",
				className,
			)}
			{...props}
		/>
	);
}
