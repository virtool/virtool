import type { PaletteColor } from "@base/types";
import { Check, Minus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";
import { getDropdownMenuItemClassName } from "./dropdownMenuItemStyles";

type DropdownMenuCheckboxItemProps = ComponentPropsWithRef<
	typeof DropdownMenu.CheckboxItem
> & {
	color?: PaletteColor;
};

export default function DropdownMenuCheckboxItem({
	checked,
	children,
	className,
	color = "gray",
	...props
}: DropdownMenuCheckboxItemProps) {
	return (
		<DropdownMenu.CheckboxItem
			checked={checked}
			className={getDropdownMenuItemClassName(color, className)}
			{...props}
		>
			<span className="flex items-center justify-center shrink-0 size-4">
				<DropdownMenu.ItemIndicator>
					{checked === "indeterminate" ? (
						<Minus className="size-3.5" strokeWidth={3} />
					) : (
						<Check className="size-3.5" strokeWidth={3} />
					)}
				</DropdownMenu.ItemIndicator>
			</span>
			{children}
		</DropdownMenu.CheckboxItem>
	);
}
