import { cn } from "@app/cn";
import type { IconColor } from "@base/types";
import type { LucideIcon } from "lucide-react";
import { iconVariants } from "./iconVariants";

export type IconProps = {
	color?: IconColor;
	icon: LucideIcon;
	className?: string;
};

export default function Icon({
	color,
	icon: LucideIcon,
	className,
	...props
}: IconProps) {
	return (
		<LucideIcon
			className={cn(
				"bg-inherit",
				"border-none",
				"text-inherit",
				"inline-block",
				"align-middle",
				"size-5",
				iconVariants({ color }),
				className,
			)}
			{...props}
		/>
	);
}
