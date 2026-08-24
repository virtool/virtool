import { cn } from "@app/cn";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

export default function DropdownMenuTrigger({
	className,
	...props
}: ComponentPropsWithRef<typeof DropdownMenu.Trigger>) {
	return (
		<DropdownMenu.Trigger
			className={cn(
				"flex cursor-pointer appearance-none border-none bg-transparent p-0",
				className,
			)}
			{...props}
		/>
	);
}
