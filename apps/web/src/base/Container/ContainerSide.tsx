import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ContainerSideProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Sidebar content container
 */
export default function ContainerSide({
	children,
	className,
}: ContainerSideProps) {
	return <div className={cn("flex-none", className)}>{children}</div>;
}
