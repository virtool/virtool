import { cn } from "@app/cn";
import Icon from "@base/Icon";
import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { MouseEvent, ReactNode } from "react";

type CheckboxProps = {
	ariaLabel?: string;
	checked?: boolean | "indeterminate";
	label?: string;
	labelComponent?: ReactNode;
	disabled?: boolean;
	id: string;
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

function Checkbox({
	ariaLabel,
	checked = false,
	id,
	label,
	labelComponent,
	onClick,
}: CheckboxProps) {
	const isIndeterminate = checked === "indeterminate";
	const isEmpty = checked === false;

	return (
		<div className="inline-flex items-center gap-3">
			<CheckboxPrimitive.Root
				aria-label={ariaLabel || label || "checkbox"}
				checked={checked}
				className={cn(
					{
						"bg-cyan-700": !isEmpty,
						"border-gray-50": isEmpty,
					},
					"border-2",
					{
						"border-gray-300": isEmpty,
						"border-cyan-700": !isEmpty,
					},
					"cursor-pointer",
					"inline-flex",
					"items-center",
					"justify-center",
					"rounded",
					"size-6",
				)}
				id={id}
				onClick={onClick}
			>
				<CheckboxPrimitive.Indicator forceMount>
					<Icon
						className={cn({ invisible: isEmpty }, "text-white")}
						icon={isIndeterminate ? Minus : Check}
					/>
				</CheckboxPrimitive.Indicator>
			</CheckboxPrimitive.Root>
			{label && (
				<label
					className="flex gap-2 items-center select-none cursor-pointer"
					htmlFor={id}
				>
					{labelComponent || label}
				</label>
			)}
		</div>
	);
}

export default Checkbox;
