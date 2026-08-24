import { cn } from "@app/cn";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

export default function DropdownMenuLabel({
	className,
	...props
}: ComponentPropsWithRef<typeof DropdownMenu.Label>) {
	return (
		<DropdownMenu.Label
			className={cn(
				"font-medium px-2 py-1.5 text-gray-500 text-xs tracking-wide uppercase",
				className,
			)}
			{...props}
		/>
	);
}
