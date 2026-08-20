import { cn } from "@app/cn";
import type { ReactNode } from "react";

type TableHeadProps = {
	/** The header cells, which the component wraps in the header row */
	children: ReactNode;

	className?: string;
};

/** The header row of a data table, holding `SortableHead` and plain `th` cells. */
export default function TableHead({ children, className }: TableHeadProps) {
	return (
		<thead className={cn("bg-white text-sm text-gray-600", className)}>
			<tr>{children}</tr>
		</thead>
	);
}
