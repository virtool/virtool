import { cn } from "@app/cn";
import type { ReactNode } from "react";

type SubviewHeaderAttributionProps = {
	children?: ReactNode;
	className?: string;
};

export default function SubviewHeaderAttribution({
	children,
	className,
}: SubviewHeaderAttributionProps) {
	return (
		<span className={cn("text-gray-600 text-sm font-medium", className)}>
			{children}
		</span>
	);
}
