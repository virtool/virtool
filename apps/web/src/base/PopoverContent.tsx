import { cn } from "@app/cn";
import { Popover } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * The floating panel of a popover, portalled out of the trigger's stacking
 * context and aligned to the trigger's start edge.
 *
 * Use this where the panel holds its own focusable widgets and the trigger has
 * to compose with surrounding markup; {@link Popover} covers the simpler case of
 * a panel hung off a single trigger element.
 */
export default function PopoverContent({
	align = "start",
	className,
	sideOffset = 4,
	...props
}: ComponentPropsWithRef<typeof Popover.Content>) {
	return (
		<Popover.Portal>
			<Popover.Content
				align={align}
				className={cn(
					"bg-white",
					"border",
					"border-gray-300",
					"origin-(--radix-popover-content-transform-origin)",
					"rounded-md",
					"shadow-lg",
					"text-sm",
					"z-popover",
					"data-[state=closed]:animate-dropdownMenuClose",
					"data-[state=open]:animate-dropdownMenuOpen",
					className,
				)}
				collisionPadding={6}
				sideOffset={sideOffset}
				{...props}
			/>
		</Popover.Portal>
	);
}
