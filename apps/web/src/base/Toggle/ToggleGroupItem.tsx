import { cn } from "@app/cn";
import { buttonVariants } from "@base/Button";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * Props for one member of a toggle group.
 *
 * Everything Radix's `ToggleGroup.Item` accepts flows through the rest spread,
 * so a `Tooltip` wrapping a member can hand its behaviour down.
 */
type ToggleGroupItemProps = ComponentPropsWithRef<
	typeof ToggleGroupPrimitive.Item
> & {
	/** Written by a wrapping tooltip trigger. Dropped — see below. */
	"data-state"?: string;
};

export default function ToggleGroupItem({
	className,
	// A tooltip trigger publishes its open state on whatever it wraps. Forwarded,
	// it would overwrite the on/off state the group sets here, so hovering a
	// member would read as deselecting it.
	"data-state": _tooltipState,
	...props
}: ToggleGroupItemProps) {
	return (
		<ToggleGroupPrimitive.Item
			className={cn(
				buttonVariants(),
				"rounded-none",
				"first:rounded-l-md",
				"last:rounded-r-md",
				className,
			)}
			{...props}
		/>
	);
}
