import { cn } from "@app/cn";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

export default function DropdownMenuSeparator({
	className,
	...props
}: ComponentPropsWithRef<typeof DropdownMenu.Separator>) {
	return (
		<DropdownMenu.Separator
			className={cn("-mx-1 bg-gray-200 h-px my-1", className)}
			{...props}
		/>
	);
}
