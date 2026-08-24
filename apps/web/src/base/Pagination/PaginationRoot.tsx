import { cn } from "@app/cn";
import type { ReactNode } from "react";

type PaginationRootProps = {
	children: ReactNode;
	className?: string;
};

/**
 * A styled pagination root component
 */
export default function PaginationRoot({
	children,
	className,
}: PaginationRootProps) {
	return (
		<nav
			aria-label="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
		>
			{children}
		</nav>
	);
}
