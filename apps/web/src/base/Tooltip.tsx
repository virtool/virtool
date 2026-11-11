import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

type TooltipProps = Omit<
	ComponentPropsWithRef<typeof TooltipPrimitive.Trigger>,
	"asChild" | "children"
> & {
	children: ReactNode;
	position?: "top" | "right" | "bottom" | "left";
	tip: ReactNode;
};

/**
 * A tip shown when the child is hovered or focused.
 *
 * Other props go to the trigger, so another Radix trigger can use the tooltip
 * as its `asChild` child.
 */
export default function Tooltip({
	children,
	position = "top",
	tip,
	...props
}: TooltipProps) {
	return (
		<TooltipPrimitive.Provider>
			<TooltipPrimitive.Root>
				<TooltipPrimitive.Trigger asChild {...props}>
					{children}
				</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						className="rounded px-4 py-2 text-sm leading-none bg-gray-800 text-white shadow-lg will-change-[transform,opacity] capitalize z-popover data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade"
						side={position}
						sideOffset={5}
					>
						{tip}
						<TooltipPrimitive.Arrow className="fill-gray-800" />
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
}
