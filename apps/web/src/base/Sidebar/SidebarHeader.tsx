import { cn } from "@app/cn";
import type { ReactNode } from "react";

type SidebarHeaderProps = {
	children?: ReactNode;
	className?: string;
};

export default function SidebarHeader({
	children,
	className,
}: SidebarHeaderProps) {
	return (
		<h3
			className={cn(
				"flex items-center justify-between text-base font-medium mt-1 mb-2.5 h-8",
				className,
			)}
		>
			{children}
		</h3>
	);
}

SidebarHeader.displayName = "SidebarHeader";
