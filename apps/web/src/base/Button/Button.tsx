import { cn } from "@app/cn";
import type { PaletteColor } from "@base/types";
import type { ComponentPropsWithRef, ElementType, ReactNode } from "react";
import { buttonVariants } from "./buttonVariants";

/**
 * Props for a button.
 *
 * Everything a `<button>` accepts flows through the rest spread, `ref` and
 * `aria-label` included. Radix's `asChild` triggers — `Tooltip`, `Dropdown` —
 * hand their behaviour to the child as props, so a wrapper that names its props
 * exhaustively silently drops them and the trigger does nothing.
 */
export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "color"> & {
	as?: ElementType;
	children: ReactNode;
	color?: PaletteColor;
	size?: "small" | "large";
};

function Button({
	as = "button",
	children,
	className,
	color = "gray",
	disabled = false,
	size = "large",
	type = "button",
	...props
}: ButtonProps) {
	const As = as;

	return (
		<As
			className={cn(
				buttonVariants({ color, size }),
				disabled ? "opacity-50" : "opacity-100",
				className,
			)}
			disabled={disabled}
			type={type}
			{...props}
		>
			{children}
		</As>
	);
}

export default Button;
