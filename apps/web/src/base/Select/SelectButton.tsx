import { cn } from "@app/cn";
import Icon from "@base/Icon";
import {
	inputFocusClasses,
	inputHeightClass,
	inputInvalidClasses,
} from "@base/styles";
import type { LucideIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { AriaAttributes } from "react";

type SelectButtonProps = {
	placeholder?: string;
	className?: string;
	icon: LucideIcon;
	id?: string;
	"aria-label"?: string;
	/** Marks the trigger invalid, turning its border and focus ring red */
	"aria-invalid"?: AriaAttributes["aria-invalid"];
	/** `id` of the element describing the trigger, e.g. an error message. */
	"aria-describedby"?: string;
};

export default function SelectButton({
	placeholder,
	icon: LucideIcon,
	className,
	id,
	"aria-label": ariaLabel,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedby,
}: SelectButtonProps) {
	return (
		<SelectPrimitive.Trigger
			aria-invalid={ariaInvalid}
			aria-label={ariaLabel}
			aria-describedby={ariaDescribedby}
			className={cn(
				"flex justify-between items-center px-2.5 bg-white border rounded font-medium capitalize [&_svg]:ml-1",
				inputHeightClass,
				inputFocusClasses,
				inputInvalidClasses,
				"data-[placeholder]:text-gray-500",
				className,
			)}
			data-slot="select-trigger"
			id={id}
		>
			<SelectPrimitive.Value placeholder={placeholder} />
			<Icon icon={LucideIcon} />
		</SelectPrimitive.Trigger>
	);
}
