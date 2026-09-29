import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/** Props for the Switch: a controlled on/off toggle. */
export type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root>;

/**
 * A toggle switch. Pass `checked` and `onCheckedChange` to control it. Inside a
 * `Field`, it takes its `id`, `aria-invalid`, and `aria-describedby` from the
 * field.
 */
export default function Switch({
	className,
	id,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	...props
}: SwitchProps) {
	const fieldProps = useFieldControl({
		id,
		"aria-describedby": ariaDescribedBy,
		"aria-invalid": ariaInvalid,
	});

	return (
		<SwitchPrimitive.Root
			className={cn(
				"relative",
				"inline-flex",
				"h-5",
				"w-9",
				"shrink-0",
				"cursor-pointer",
				"items-center",
				"rounded-full",
				"border-2",
				"border-transparent",
				"bg-gray-300",
				"transition-colors",
				"data-[state=checked]:bg-blue-600",
				"focus-visible:ring-2",
				"focus-visible:ring-blue-500",
				"focus-visible:outline-none",
				"disabled:cursor-not-allowed",
				"disabled:opacity-50",
				className,
			)}
			data-slot="switch"
			{...fieldProps}
			{...props}
		>
			<SwitchPrimitive.Thumb
				className={cn(
					"block",
					"h-4",
					"w-4",
					"rounded-full",
					"bg-white",
					"shadow-sm",
					"transition-transform",
					"translate-x-0",
					"data-[state=checked]:translate-x-4",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}
