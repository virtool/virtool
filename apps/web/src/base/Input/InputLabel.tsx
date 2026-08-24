import { cn } from "@app/cn";
import type { ReactNode } from "react";

type InputLabelProps = {
	children: ReactNode;

	/** Overrides the label's own styling, to hide it visually for instance */
	className?: string;

	htmlFor?: string;
	id?: string;
};

export default function InputLabel({
	children,
	className,
	htmlFor,
	id,
}: InputLabelProps) {
	return (
		<label
			htmlFor={htmlFor}
			id={id}
			className={cn("font-medium mb-2 inline-block", className)}
		>
			{children}
		</label>
	);
}
