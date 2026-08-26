// biome-ignore-all lint/a11y/useFocusableInteractive: ARIA table rows and headers do not require independent focus.
// biome-ignore-all lint/a11y/useSemanticElements: Grid layout requires div elements with explicit table roles.
import { cn } from "@app/cn";
import Checkbox from "@base/Checkbox";
import Icon from "@base/Icon";
import type { SampleSortField, SortDirection } from "@virtool/contracts";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

type SampleTableHeadProps = {
	checked: boolean | "indeterminate";
	direction: SortDirection;
	onSelectAll: () => void;
	onSort: (field: SampleSortField) => void;
	sort: SampleSortField | undefined;
};

type SortableColumnProps = {
	children: ReactNode;
	className?: string;
	direction: SortDirection;
	field: SampleSortField;
	onSort: (field: SampleSortField) => void;
	sort: SampleSortField | undefined;
};

function SortableColumn({
	children,
	className,
	direction,
	field,
	onSort,
	sort,
}: SortableColumnProps) {
	const active =
		sort === field || (sort === undefined && field === "createdAt");

	return (
		<div
			aria-sort={active ? direction : "none"}
			className={cn("py-2", className)}
			role="columnheader"
		>
			<button
				className="flex cursor-pointer items-center gap-1 rounded-sm hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
				onClick={() => onSort(field)}
				type="button"
			>
				{children}
				<span aria-hidden className="flex items-center">
					<Icon
						className="size-4"
						icon={
							active
								? direction === "ascending"
									? ChevronUp
									: ChevronDown
								: ChevronsUpDown
						}
					/>
				</span>
			</button>
		</div>
	);
}

/** The column headers for the samples table. */
export default function SampleTableHead({
	checked,
	direction,
	onSelectAll,
	onSort,
	sort,
}: SampleTableHeadProps) {
	return (
		<div
			className="grid grid-cols-subgrid col-span-full text-sm font-semibold text-gray-600"
			role="rowgroup"
		>
			<div
				className="grid grid-cols-subgrid col-span-full items-center"
				role="row"
			>
				<div className="py-2 pl-4" role="columnheader">
					<span className="sr-only">Select</span>
					<Checkbox
						ariaLabel="Select all samples"
						checked={checked}
						id="SampleSelectAll"
						onClick={onSelectAll}
					/>
				</div>
				<SortableColumn
					direction={direction}
					field="name"
					onSort={onSort}
					sort={sort}
				>
					Name
				</SortableColumn>
				<div className="hidden py-2 2xl:block" role="columnheader">
					Library Type
				</div>
				<div className="hidden py-2 2xl:block" role="columnheader">
					Labels
				</div>
				<div className="py-2" role="columnheader">
					Workflows
				</div>
				<SortableColumn
					direction={direction}
					field="createdAt"
					onSort={onSort}
					sort={sort}
				>
					Created
				</SortableColumn>
				<SortableColumn
					direction={direction}
					field="user"
					onSort={onSort}
					sort={sort}
				>
					User
				</SortableColumn>
				<div className="py-2 pr-4" role="columnheader">
					<span className="sr-only">Actions</span>
				</div>
			</div>
		</div>
	);
}
