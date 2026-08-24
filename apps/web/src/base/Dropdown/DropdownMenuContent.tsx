import { cn } from "@app/cn";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * The floating panel of a dropdown menu, portalled out of the trigger's
 * stacking context and aligned to the trigger's start edge.
 */
export default function DropdownMenuContent({
	align = "start",
	className,
	sideOffset = 4,
	...props
}: ComponentPropsWithRef<typeof DropdownMenu.Content>) {
	return (
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"bg-white",
					"border",
					"border-gray-300",
					"flex",
					"flex-col",
					"max-h-(--radix-dropdown-menu-content-available-height)",
					"min-w-32",
					"origin-(--radix-dropdown-menu-content-transform-origin)",
					"overflow-x-hidden",
					"overflow-y-auto",
					"p-1",
					"rounded-md",
					"shadow-lg",
					"text-sm",
					"z-dropdown",
					"data-[state=closed]:animate-dropdownMenuClose",
					"data-[state=open]:animate-dropdownMenuOpen",
					className,
				)}
				{...props}
			/>
		</DropdownMenu.Portal>
	);
}
