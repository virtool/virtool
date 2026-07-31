import { cn } from "@app/cn";
import { Popover as PopoverPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type PopoverProps = {
	align?: "center" | "start" | "end";

	/** How far the content is shifted along the trigger's edge */
	alignOffset?: number;

	children: ReactNode;

	/** How far the content sits from the trigger */
	sideOffset?: number;

	trigger: ReactNode;
};

/**
 * A styled popover component
 */
export default function Popover({
	align = "end",
	alignOffset = -20,
	children,
	sideOffset = 15,
	trigger,
}: PopoverProps) {
	return (
		<PopoverPrimitive.Root>
			<PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					className={cn(
						"bg-white",
						"rounded-lg",
						"border",
						"border-gray-300",
						"shadow-lg",
						"w-[320px]",
						"z-popover",
					)}
					sideOffset={sideOffset}
					align={align}
					alignOffset={alignOffset}
					collisionPadding={6}
				>
					{children}
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
