import { cn } from "@app/cn";
import type { ReactNode } from "react";

type TableActionsCellProps = {
	/** The row's controls, laid out in a row against the table's right edge */
	children: ReactNode;

	className?: string;
};

/**
 * The trailing cell of a table row, holding the controls that act on that row.
 *
 * Sized to its contents so the columns beside it keep the rest of the width.
 */
export default function TableActionsCell({
	children,
	className,
}: TableActionsCellProps) {
	return (
		<td className={cn("w-px", className)}>
			<span className="flex items-center gap-1 justify-end">{children}</span>
		</td>
	);
}
