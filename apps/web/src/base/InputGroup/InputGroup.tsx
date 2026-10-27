import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Props for an `InputGroup`. */
export type InputGroupProps = ComponentProps<"div">;

/**
 * A bordered row that joins an `InputGroupInput` with `InputGroupAddon`s such
 * as icons, text, and buttons. The group draws the border and focus ring, so
 * the addons sit inside the input's frame without padding overrides.
 */
export default function InputGroup({ className, ...props }: InputGroupProps) {
	return (
		<div
			className={cn(
				"group/input-group relative flex w-full min-w-0 items-center rounded border border-gray-300 bg-white h-10 transition-[color,box-shadow]",
				"has-[[data-slot=input-group-control]:focus-visible]:border-blue-500 has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-blue-500/50",
				"has-[[data-slot=input-group-control][aria-invalid=true]]:border-red-500 has-[[data-slot=input-group-control][aria-invalid=true]:focus-visible]:ring-red-500/50",
				"has-[[data-slot=input-group-control]:disabled]:opacity-50",
				className,
			)}
			data-slot="input-group"
			{...props}
		/>
	);
}
