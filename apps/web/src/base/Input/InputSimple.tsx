import { cn } from "@app/cn";
import {
	inputBaseClasses,
	inputFocusClasses,
	inputHeightClass,
	inputInvalidClasses,
} from "@base/styles";
import type { ComponentPropsWithRef } from "react";

export type InputSimpleProps = ComponentPropsWithRef<"input"> & {
	className?: string;
	as?: string;
};

export default function InputSimple({ className, ...props }: InputSimpleProps) {
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
			{...props}
		/>
	);
}
