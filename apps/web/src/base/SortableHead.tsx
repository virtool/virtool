import { cn } from "@app/cn";
import type { SortDirection } from "@virtool/contracts";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import Icon from "./Icon";

type SortableHeadProps<T extends string> = {
	/** The column label */
	children: ReactNode;

	className?: string;

	/** The direction the list is currently ordered in */
	direction: SortDirection;

	/** The column this header sorts by */
	field: T;

	/** Called with this header's field when it is clicked */
	onSort: (field: T) => void;

	/** The column the list is currently sorted by, if any */
	sort: T | undefined;
};

/**
 * A column header that sorts the table by its column.
 *
 * Clicking an inactive header sorts by it; clicking the active one again
 * reverses the direction. The caller owns the sort state and decides what each
 * click does with it — this only reports which column was asked for.
 *
 * `aria-sort` sits on the `<th>` and carries the direction for the active
 * column only, so assistive technology announces one sorted column rather than
 * a table sorted every which way. The direction arrow follows the same rule and
 * is decorative: `aria-sort` already says everything it does.
 */
export default function SortableHead<T extends string>({
	children,
	className,
	direction,
	field,
	onSort,
	sort,
}: SortableHeadProps<T>) {
	const active = sort === field;

	return (
		<th
			aria-sort={active ? direction : "none"}
			className={className}
			scope="col"
		>
			<button
				className={cn(
					"cursor-pointer",
					"flex",
					"gap-1",
					"items-center",
					"rounded-sm",
					"hover:text-gray-900",
					"focus-visible:outline-2",
					"focus-visible:outline-offset-2",
					"focus-visible:outline-cyan-600",
				)}
				onClick={() => onSort(field)}
				type="button"
			>
				{children}
				{active && (
					<span aria-hidden>
						<Icon
							className="size-4"
							icon={direction === "ascending" ? ArrowUp : ArrowDown}
						/>
					</span>
				)}
			</button>
		</th>
	);
}
