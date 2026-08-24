import { cn } from "@app/cn";
import Icon from "@base/Icon";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PaletteColor } from "./types";

const alertColorStyles: Record<PaletteColor, string> = {
	blue: "bg-blue-100 text-blue-700",
	green: "bg-green-100 text-green-700",
	gray: "bg-gray-100 text-gray-600",
	orange: "bg-amber-100 text-amber-600",
	purple: "bg-purple-100 text-purple-700",
	red: "bg-red-100 text-red-700",
};

const defaultColorStyle = alertColorStyles.gray;

type AlertProps = {
	block?: boolean;
	children: ReactNode;
	className?: string;
	color?: PaletteColor;
	icon?: LucideIcon;
	level?: boolean;
	outerClassName?: string;
};

function Alert({
	block,
	children,
	className,
	color,
	icon,
	level,
	outerClassName,
}: AlertProps) {
	return (
		<div
			className={cn(
				"rounded-md shadow-sm font-medium mb-4 overflow-hidden",
				(color && alertColorStyles[color]) ?? defaultColorStyle,
				outerClassName,
			)}
		>
			<div
				className={cn(
					"p-4 gap-2",
					block ? "block" : "flex",
					level && "items-center",
					className,
				)}
			>
				{icon ? <Icon icon={icon} className="size-6" /> : null}
				{children}
			</div>
		</div>
	);
}

Alert.displayName = "Alert";

export default Alert;
