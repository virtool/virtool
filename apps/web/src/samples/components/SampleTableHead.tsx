import Checkbox from "@base/Checkbox";
import SortableHead from "@base/SortableHead";
import { TableActionsHead, TableHead } from "@base/Table";
import type { SampleSortField, SortDirection } from "@virtool/contracts";

type SampleTableHeadProps = {
	/** Whether every, some, or no sample on the page is selected */
	checked: boolean | "indeterminate";

	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** Callback to select or deselect every sample on the page */
	onSelectAll: () => void;

	/** Callback to sort by a column, or to reverse the column already sorted by */
	onSort: (field: SampleSortField) => void;

	/** The column the list is sorted by, if any */
	sort: SampleSortField | undefined;
};

/**
 * The column headers for the samples table.
 *
 * Workflows are not sortable because each sample can have multiple workflow
 * states. The select-all checkbox names its own cell, and the trailing action
 * column is named for assistive technology.
 */
export default function SampleTableHead({
	checked,
	direction,
	onSelectAll,
	onSort,
	sort,
}: SampleTableHeadProps) {
	return (
		<TableHead>
			<th className="w-16" scope="col">
				<span className="sr-only">Select</span>
				<Checkbox
					ariaLabel="Select all samples"
					checked={checked}
					id="SampleSelectAll"
					onClick={onSelectAll}
				/>
			</th>
			<SortableHead
				direction={direction}
				field="name"
				onSort={onSort}
				sort={sort}
			>
				Name
			</SortableHead>
			<th className="hidden w-32 2xl:table-cell" scope="col">
				Library Type
			</th>
			<th className="w-64" scope="col">
				Workflows
			</th>
			<SortableHead
				className="w-40"
				direction={direction}
				field="createdAt"
				onSort={onSort}
				sort={sort}
			>
				Created
			</SortableHead>
			<SortableHead
				className="w-40"
				direction={direction}
				field="user"
				onSort={onSort}
				sort={sort}
			>
				User
			</SortableHead>
			<TableActionsHead className="w-16" />
		</TableHead>
	);
}
