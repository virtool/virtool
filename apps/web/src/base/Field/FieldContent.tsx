import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Props for a `FieldContent`. */
export type FieldContentProps = ComponentProps<"div">;

/** Stacks a `FieldTitle` or `FieldLabel` above its description in a horizontal `Field`. */
export default function FieldContent({
	className,
	...props
}: FieldContentProps) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-1 flex-col [&>[data-slot=field-description]]:mt-0",
				className,
			)}
			data-slot="field-content"
			{...props}
		/>
	);
}
