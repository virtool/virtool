import { cn } from "@app/cn";
import type { ReactNode } from "react";

/**
 * How a table lays its columns out.
 *
 * `keyValue` is the detail-panel shape: a narrow first column of row labels,
 * ruled off from the values beside it and aligned to the top so a tall value
 * does not float its label. `data` is a list of records, where the first column
 * is a field like any other.
 */
type TableVariant = "data" | "keyValue";

type TableProps = {
	children: ReactNode;
	className?: string;
	variant?: TableVariant;
};

/**
 * Replacement for the HTML table element
 */
export default function Table({
	children,
	className,
	variant = "keyValue",
}: TableProps) {
	return (
		<table
			className={cn(
				"w-full",
				"border-collapse",
				"bg-white",
				"[&_th]:font-semibold",
				"[&_th]:text-left",
				"[&_th]:p-3",
				"[&_td]:p-2",
				"[&_tr]:border-b",
				"[&_tr]:border-gray-200",
				"[&_tr:last-child]:border-b-0",
				variant === "keyValue" && [
					"[&_th:first-child]:w-1/5",
					"[&_td,&_th]:align-top",
					"[&_td:first-child]:border-r",
					"[&_td:first-child]:border-gray-200",
					"[&_th:first-child]:border-r",
					"[&_th:first-child]:border-gray-200",
				],
				variant === "data" && ["[&_td,&_th]:align-middle"],
				className,
			)}
		>
			{children}
		</table>
	);
}
