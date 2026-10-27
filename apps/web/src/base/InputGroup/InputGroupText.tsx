import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Plain text or an icon inside an `InputGroupAddon`, such as a unit or prefix. */
export default function InputGroupText({
	className,
	...props
}: ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"flex items-center gap-2 text-sm text-gray-500 [&_svg]:size-4",
				className,
			)}
			data-slot="input-group-text"
			{...props}
		/>
	);
}
