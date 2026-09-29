import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import Icon from "@base/Icon";
import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { type MouseEvent, type ReactNode, useId } from "react";

type CheckboxProps = {
	ariaLabel?: string;
	checked?: boolean | "indeterminate";
	label?: string;
	labelComponent?: ReactNode;
	disabled?: boolean;
	/** Defaults to the control id of a surrounding `Field`, or a generated id. */
	id?: string;
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
	const generatedId = useId();
	const fieldProps = useFieldControl({ id });
	const controlId = fieldProps.id ?? generatedId;
	const isIndeterminate = checked === "indeterminate";
	const isEmpty = checked === false;

	return (
		<div className="inline-flex items-center gap-3">
			<CheckboxPrimitive.Root
				{...fieldProps}
				id={controlId}
				aria-label={ariaLabel || label}
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
				data-slot="checkbox"
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
					htmlFor={controlId}
				>
					{labelComponent || label}
				</label>
			)}
		</div>
	);
}

export default Checkbox;
