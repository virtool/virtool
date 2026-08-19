import { cn } from "@app/cn";
import type { ComponentProps, ReactNode } from "react";
import Table from "./Table";

type BoxGroupTableProps = {
	children: ReactNode;
	className?: string;
	variant?: ComponentProps<typeof Table>["variant"];
};

/**
 * Replacement for the HTML table element within a BoxGroup
 */
export default function BoxGroupTable({
	children,
	className,
	variant,
}: BoxGroupTableProps) {
	return (
		<Table
			className={cn(
				"border-none",
				"m-0",
				"first:border-t-0",
				"[&_tbody]:border-t-0",
				"[&_td]:min-w-0 [&_th]:min-w-0",
				"[&_td]:px-4 [&_th]:px-4",
				"[&_td]:py-2 [&_th]:py-2",
				className,
			)}
			variant={variant}
		>
			{children}
		</Table>
	);
}
