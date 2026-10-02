import { cn } from "@app/cn";
import type { ComponentProps } from "react";

/** Props for a button that looks like a link. */
type LinkButtonProps = ComponentProps<"button">;

/**
 * A button styled as an inline link, for secondary actions that change the
 * current view instead of submitting it.
 */
export default function LinkButton({
	className,
	type = "button",
	...props
}: LinkButtonProps) {
	return (
		<button
			className={cn(
				"cursor-pointer rounded font-medium text-blue-700 outline-none hover:text-blue-900 hover:underline",
				"focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			type={type}
			{...props}
		/>
	);
}
