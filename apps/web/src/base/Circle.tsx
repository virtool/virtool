import { cn } from "@app/cn";
import { iconVariants } from "@base/Icon";
import type React from "react";
import type { IconColor } from "./types";

export type CircleProps = {
	/** The color of the circle */
	color?: IconColor;
	/** Additional class names to apply to the circle */
	className?: string;
	/** Whether the circle should be full, empty, or half filled */
	fill?: "full" | "empty" | "half";
} & React.SVGProps<SVGSVGElement>;

/**
 * A simple circle component rendered as an SVG. Size it with a `size-*`
 * utility on `className`; it defaults to `size-3`.
 */
export default function Circle({
	color = "black",
	className,
	fill = "full",
	...props
}: CircleProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 10 10"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={cn(
				"bg-inherit",
				"inline-block",
				"size-3",
				iconVariants({ color }),
				className,
			)}
			{...props}
		>
			{fill === "full" && <circle cx="5" cy="5" r="5" fill="currentColor" />}
			{fill === "half" && (
				<>
					<path d="M 5 0.5 A 4.5 4.5 0 0 0 5 9.5 Z" fill="currentColor" />
					<circle
						cx="5"
						cy="5"
						r="4.5"
						stroke="currentColor"
						strokeWidth="1"
						fill="none"
					/>
				</>
			)}
			{fill === "empty" && (
				<circle
					cx="5"
					cy="5"
					r="4.5"
					stroke="currentColor"
					strokeWidth="1"
					fill="none"
				/>
			)}
		</svg>
	);
}
