import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/** Props for the RadioGroup root: wraps a set of mutually-exclusive options. */
export type RadioGroupProps = ComponentProps<typeof RadioGroupPrimitive.Root>;

/** Props for an individual RadioGroup option, identified by its `value`. */
export type RadioGroupItemProps = ComponentProps<
	typeof RadioGroupPrimitive.Item
>;

/**
 * Root of a radio group. Pass `value` and `onValueChange` to control the
 * selection; children should be `RadioGroupItem`s.
 */
export function RadioGroup({ className, ...props }: RadioGroupProps) {
	return (
		<RadioGroupPrimitive.Root
			className={cn("grid gap-2", className)}
			{...props}
		/>
	);
}

/**
 * A single radio option. Renders as a grey ring that fills with a thick blue
 * ring around a white dot when selected; reachable by keyboard and exposes
 * `role="radio"`. Inside a `Field`, it takes its `id` and ARIA connections
 * from the field.
 */
export function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
	const { "aria-invalid": _, ...fieldProps } = useFieldControl(props);

	return (
		<RadioGroupPrimitive.Item
			className={cn(
				"group",
				"size-5",
				"shrink-0",
				"rounded-full",
				"cursor-pointer",
				"focus-visible:ring-2",
				"focus-visible:ring-blue-500",
				"focus-visible:outline-none",
				"disabled:cursor-not-allowed",
				"disabled:opacity-50",
				className,
			)}
			data-slot="radio-group-item"
			{...props}
			{...fieldProps}
		>
			{/* An SVG stays circular when fractional zoom rounds the box to unequal sides. */}
			<svg
				aria-hidden="true"
				className="block size-full overflow-visible"
				viewBox="0 0 20 20"
			>
				<circle
					className="fill-white stroke-gray-300 stroke-2"
					cx="10"
					cy="10"
					r="9"
				/>
				<circle
					className="hidden fill-white stroke-blue-600 stroke-6 group-data-[state=checked]:inline"
					cx="10"
					cy="10"
					r="7"
				/>
			</svg>
		</RadioGroupPrimitive.Item>
	);
}
