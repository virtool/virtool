import { cn } from "@app/cn";
import { Popover } from "radix-ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

type ComboBoxMenuProps = {
	/** The props Downshift's `getMenuProps` returns for the listbox element. */
	menuProps: ComponentPropsWithRef<"ul">;

	/** The option rows, rendered by the caller only while the menu is open. */
	children: ReactNode;
};

/**
 * The floating listbox of a combobox, portalled out of the flow that holds the
 * input.
 *
 * An in-flow menu grows the scroll height of an enclosing `overflow-y-auto`
 * container, such as a dialog, which can raise a scrollbar and shift the
 * layout. Anchoring the menu through a portal keeps it out of that flow and
 * lets it flip and stay within the viewport. The `<ul>` keeps its own
 * `listbox` role and Downshift props; only its position moves.
 */
export default function ComboBoxMenu({
	menuProps,
	children,
}: ComboBoxMenuProps) {
	return (
		<Popover.Portal>
			<Popover.Content
				asChild
				align="start"
				sideOffset={4}
				collisionPadding={6}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<ul
					{...menuProps}
					className={cn(
						"z-dropdown",
						"w-(--radix-popper-anchor-width)",
						"max-h-[min(15rem,var(--radix-popper-available-height))]",
						"overflow-y-auto",
						"bg-white",
						"border",
						"border-gray-300",
						"rounded-md",
						"shadow-md",
						"outline-none",
					)}
				>
					{children}
				</ul>
			</Popover.Content>
		</Popover.Portal>
	);
}
