import type { PaletteColor } from "@base/types";
import { Circle } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef } from "react";
import { getDropdownMenuItemClassName } from "./dropdownMenuItemStyles";

type DropdownMenuRadioItemProps = ComponentPropsWithRef<
	typeof DropdownMenu.RadioItem
> & {
	color?: PaletteColor;
};

export default function DropdownMenuRadioItem({
	children,
	className,
	color = "gray",
	...props
}: DropdownMenuRadioItemProps) {
	return (
		<DropdownMenu.RadioItem
			className={getDropdownMenuItemClassName(color, className)}
			{...props}
		>
			<span className="flex items-center justify-center shrink-0 size-4">
				<DropdownMenu.ItemIndicator>
					<Circle className="fill-current size-2" />
				</DropdownMenu.ItemIndicator>
			</span>
			{children}
		</DropdownMenu.RadioItem>
	);
}
