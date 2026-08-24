import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ContainerNarrowProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Smaller page content container such as for file managers and settings
 */
export default function ContainerNarrow({
	children,
	className,
}: ContainerNarrowProps) {
	return (
		<div className={cn("flex-grow", "flex-shrink-0", "max-w-7xl", className)}>
			{children}
		</div>
	);
}
