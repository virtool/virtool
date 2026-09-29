import { cn } from "@app/cn";
import type { ComponentProps, MouseEvent } from "react";

/** Props for an `InputGroupAddon`. */
export type InputGroupAddonProps = ComponentProps<"div"> & {
	/** Places the addon before or after the input. */
	align?: "inline-start" | "inline-end";
};

/**
 * An icon, text, or button that sits inside an `InputGroup`. Clicking the
 * addon, but not a button in it, focuses the input.
 */
export default function InputGroupAddon({
	align = "inline-start",
	className,
	onClick,
	...props
}: InputGroupAddonProps) {
	function handleClick(event: MouseEvent<HTMLDivElement>) {
		onClick?.(event);

		if ((event.target as HTMLElement).closest("button")) {
			return;
		}

		event.currentTarget.parentElement
			?.querySelector<HTMLInputElement>("[data-slot=input-group-control]")
			?.focus();
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a pointer shortcut to the input, which keyboard users reach directly
		<div
			className={cn(
				"flex h-full shrink-0 cursor-text items-center gap-2 text-gray-500 select-none",
				align === "inline-start" ? "order-first pl-2.5" : "order-last pr-1.5",
				className,
			)}
			data-align={align}
			data-slot="input-group-addon"
			onClick={handleClick}
			{...props}
		/>
	);
}
