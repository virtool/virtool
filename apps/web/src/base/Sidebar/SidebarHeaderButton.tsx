import { cn } from "@app/cn";
import type { ComponentPropsWithoutRef } from "react";

type SidebarHeaderButtonProps = ComponentPropsWithoutRef<"button">;

export default function SidebarHeaderButton({
	children,
	className,
	...props
}: SidebarHeaderButtonProps) {
	return (
		<button
			className={cn(
				"flex items-center justify-center bg-gray-100 text-gray-500 text-sm border-none rounded-full cursor-pointer h-8 w-8 hover:bg-gray-500 hover:text-white hover:shadow-sm focus:bg-gray-400 focus:text-white focus:shadow-sm focus:outline-none",
				className,
			)}
			type="button"
			{...props}
		>
			{children}
		</button>
	);
}

SidebarHeaderButton.displayName = "SidebarHeaderButton";
