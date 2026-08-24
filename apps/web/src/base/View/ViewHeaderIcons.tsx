import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ViewHeaderIconsProps = {
	children?: ReactNode;
	className?: string;
};

export default function ViewHeaderIcons({
	children,
	className,
}: ViewHeaderIconsProps) {
	return (
		<div className={cn("flex items-center text-base ml-auto gap-1", className)}>
			{children}
		</div>
	);
}
