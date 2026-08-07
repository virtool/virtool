import { cn } from "@app/cn";
import BoxGroup from "@base/BoxGroup";
import RelativeTime from "@base/RelativeTime";
import type { ReactNode } from "react";
import { useDashboardCardHeadingId } from "./DashboardCard";

/** The padding every dashboard table cell shares. */
const cellClassName = "px-6 py-3";

type DashboardTableProps = {
	/** The `DashboardTableRow`s, plus an optional `DashboardTableMore`. */
	children: ReactNode;

	/** The column labels, in order. The last is aligned to the trailing edge. */
	labels: [string, string, string];
};

/**
 * The list body of a dashboard card.
 *
 * Every card gets the same three fixed-width columns, so a reader scanning down
 * the page finds each card's attribution in the same place rather than wherever
 * that card's content happened to push it.
 */
export default function DashboardTable({
	children,
	labels,
}: DashboardTableProps) {
	const [first, second, third] = labels;

	return (
		<BoxGroup className="mb-0 overflow-hidden">
			<table
				aria-labelledby={useDashboardCardHeadingId()}
				className="table-fixed w-full"
			>
				<thead>
					<tr className="bg-gray-50 border-b-1 border-gray-300 text-gray-600 text-sm">
						<th className={cn(cellClassName, "font-medium text-left w-1/3")}>
							{first}
						</th>
						<th className={cn(cellClassName, "font-medium text-left w-1/3")}>
							{second}
						</th>
						<th className={cn(cellClassName, "font-medium text-right w-1/3")}>
							{third}
						</th>
					</tr>
				</thead>
				<tbody>{children}</tbody>
			</table>
		</BoxGroup>
	);
}

type DashboardTableRowProps = {
	/** Exactly three `DashboardTableCell`s. */
	children: ReactNode;
};

/** One record in a dashboard table. */
export function DashboardTableRow({ children }: DashboardTableRowProps) {
	return <tr className="border-gray-300 not-last:border-b-1">{children}</tr>;
}

type DashboardTableCellProps = {
	/** Which edge the cell's content sits against. */
	align?: "start" | "end";

	children: ReactNode;
};

/** One column of a dashboard table row. */
export function DashboardTableCell({
	align = "start",
	children,
}: DashboardTableCellProps) {
	return (
		<td className={cellClassName}>
			<div
				className={cn("flex gap-2 items-center min-w-0", {
					"justify-end": align === "end",
				})}
			>
				{children}
			</div>
		</td>
	);
}

type DashboardTableCreatedCellProps = {
	/** When the record was created. */
	time: Date | null;
};

/**
 * The trailing column every dashboard table ends with.
 *
 * Just the time: the card lists the reader's own records, so an avatar and a
 * handle repeated down the column say nothing the heading has not already said.
 */
export function DashboardTableCreatedCell({
	time,
}: DashboardTableCreatedCellProps) {
	return (
		<DashboardTableCell align="end">
			<span className="text-gray-600 text-sm">
				<RelativeTime time={time} />
			</span>
		</DashboardTableCell>
	);
}

type DashboardTableMoreProps = {
	/** The overflow line — a link where there is somewhere to send the reader. */
	children: ReactNode;
};

/**
 * The last row of a dashboard table, accounting for the rows the card does not
 * have room for.
 *
 * Sits inside the same table as the rows it follows, so a card that is showing
 * everything simply ends at its last row with nothing to explain.
 */
export function DashboardTableMore({ children }: DashboardTableMoreProps) {
	return (
		<tr className="bg-gray-50">
			<td
				className={cn(cellClassName, "text-center text-gray-600 text-sm")}
				colSpan={3}
			>
				{children}
			</td>
		</tr>
	);
}
