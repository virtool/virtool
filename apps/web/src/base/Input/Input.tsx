import { cn } from "@app/cn";
import {
	inputBaseClasses,
	inputFocusClasses,
	inputHeightClass,
	inputInvalidClasses,
} from "@base/styles";
import type { ComponentProps } from "react";
import { useIsInvalid } from "./InputContext";

/** Props for the shared single-line text input. Accepts any native input attribute. */
export type InputProps = ComponentProps<"input"> & {
	/** Marks the input invalid, turning its border and focus ring red. Falls back to the error on a surrounding `InputGroup`. */
	error?: string;
};

export default function Input({ className, error, ...props }: InputProps) {
	const invalid = useIsInvalid(error);

	return (
		<input
			aria-invalid={invalid || undefined}
			className={cn(
				inputBaseClasses,
				inputHeightClass,
				inputFocusClasses,
				inputInvalidClasses,
				"read-only:bg-gray-100",
				className,
			)}
			{...props}
		/>
	);
}
