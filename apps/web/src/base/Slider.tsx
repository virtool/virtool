import { cn } from "@app/cn";
import { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * Props for a single-thumb slider.
 *
 * `aria-label` is required and lands on the thumb: the thumb is what takes
 * focus and reports the value, so a name on the root would never be announced.
 */
export type SliderProps = ComponentPropsWithRef<typeof SliderPrimitive.Root> & {
	"aria-label": string;
};

/**
 * A slider for choosing one value from a range.
 *
 * Single-thumb only — Radix pairs one `Thumb` with each entry in `value`, so a
 * range would need a second one rendered here.
 */
export default function Slider({
	"aria-label": ariaLabel,
	className,
	...props
}: SliderProps) {
	return (
		<SliderPrimitive.Root
			className={cn(
				"relative",
				"flex",
				"w-full",
				"touch-none",
				"select-none",
				"items-center",
				"data-[disabled]:opacity-50",
				className,
			)}
			{...props}
		>
			<SliderPrimitive.Track
				className={cn(
					"relative",
					"h-1.5",
					"w-full",
					"grow",
					"rounded-full",
					"bg-gray-200",
				)}
			>
				<SliderPrimitive.Range
					className={cn("absolute", "h-full", "rounded-full", "bg-blue-600")}
				/>
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				aria-label={ariaLabel}
				className={cn(
					"block",
					"size-4",
					"rounded-full",
					"border",
					"border-gray-400",
					"bg-white",
					"shadow-sm",
					"cursor-pointer",
					"transition-colors",
					"hover:bg-gray-50",
					"focus-visible:outline-none",
					"focus-visible:ring-2",
					"focus-visible:ring-blue-500",
					"data-[disabled]:cursor-not-allowed",
				)}
			/>
		</SliderPrimitive.Root>
	);
}
