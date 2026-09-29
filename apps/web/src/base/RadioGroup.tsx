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
 * A single radio option. Renders as a circular button with a filled dot when
 * selected; reachable by keyboard and exposes `role="radio"`. Inside a
 * `Field`, it takes its `id` and `aria-describedby` from the field.
 */
export function RadioGroupItem({
	className,
	id,
	"aria-describedby": ariaDescribedBy,
	...props
}: RadioGroupItemProps) {
	const { "aria-invalid": _, ...fieldProps } = useFieldControl({
		id,
		"aria-describedby": ariaDescribedBy,
	});

	return (
		<RadioGroupPrimitive.Item
			className={cn(
				"h-5",
				"w-5",
				"shrink-0",
				"rounded-full",
				"border-2",
				"border-gray-300",
				"bg-white",
				"cursor-pointer",
				"flex",
				"items-center",
				"justify-center",
				"data-[state=checked]:border-gray-900",
				"data-[state=checked]:bg-gray-900",
				"focus-visible:ring-2",
				"focus-visible:ring-blue-500",
				"focus-visible:outline-none",
				"disabled:cursor-not-allowed",
				"disabled:opacity-50",
				className,
			)}
			data-slot="radio-group-item"
			{...fieldProps}
			{...props}
		>
			<RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-white" />
		</RadioGroupPrimitive.Item>
	);
}
