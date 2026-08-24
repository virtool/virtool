import { cn } from "@app/cn";
import { InputLabel } from "@base/Input";
import { ToggleGroup } from "radix-ui";
import { type ReactNode, useId } from "react";

type SelectBoxProps = {
	children: ReactNode;
	className?: string;
	label: string;
	onValueChange: (value: string) => void;
	value: string;
};

export function SelectBox({
	children,
	className,
	label,
	onValueChange,
	value,
}: SelectBoxProps) {
	const labelId = useId();

	return (
		<div>
			<InputLabel id={labelId}>{label}</InputLabel>
			<ToggleGroup.Root
				aria-labelledby={labelId}
				className={cn("grid gap-4", className)}
				onValueChange={(newValue) => {
					if (newValue) {
						onValueChange(newValue);
					}
				}}
				type="single"
				value={value}
			>
				{children}
			</ToggleGroup.Root>
		</div>
	);
}

type SelectBoxItemProps = {
	children: ReactNode;
	className?: string;
	value: string;
};

export function SelectBoxItem({
	children,
	className,
	value,
}: SelectBoxItemProps) {
	return (
		<ToggleGroup.Item
			className={cn(
				"border",
				"border-gray-300",
				"rounded-sm",
				"bg-white",
				"text-left",
				"p-4",
				"cursor-pointer",
				"data-[state=on]:border-blue-600",
				"data-[state=on]:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_color-mix(in_srgb,var(--color-blue-500)_60%,transparent)]",
				"[&>div:first-child]:font-semibold",
				"[&>div:first-child]:pb-1",
				"[&>span]:text-gray-700",
				"[&>span]:pt-1",
				className,
			)}
			value={value}
		>
			{children}
		</ToggleGroup.Item>
	);
}
