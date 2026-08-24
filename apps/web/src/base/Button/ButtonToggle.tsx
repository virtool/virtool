import { cn } from "@app/cn";
import { Toggle } from "radix-ui";
import type { ComponentPropsWithRef } from "react";
import { buttonVariants } from "./buttonVariants";

/**
 * Props for a toggle button.
 *
 * Everything Radix's `Toggle.Root` accepts flows through the rest spread. A
 * `Tooltip` wrapping this hands its behaviour down as props, so naming the
 * props exhaustively would drop them and the tooltip would never open.
 */
type ButtonToggleProps = ComponentPropsWithRef<typeof Toggle.Root> & {
	/** Written by a wrapping tooltip trigger. Dropped — see below. */
	"data-state"?: string;
};

export default function ButtonToggle({
	className,
	// A tooltip trigger publishes its open state on whatever it wraps. Forwarded,
	// it would land on the button after Radix set the toggle's own on/off state
	// there and overwrite it, so a tooltip would silently redefine what the
	// toggle reports. The tooltip only styles its trigger with it, and nothing
	// here styles off it.
	"data-state": _tooltipState,
	...props
}: ButtonToggleProps) {
	return <Toggle.Root className={cn(buttonVariants(), className)} {...props} />;
}
