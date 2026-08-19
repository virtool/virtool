import Checkbox from "@base/Checkbox";
import SortableHead from "@base/SortableHead";
import type { SortDirection, UploadSortField } from "@virtool/contracts";

type UploadTableHeadProps = {
	/** Whether every, some, or no file on the page is selected */
	checked: boolean | "indeterminate";

	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** Callback to sort by a column, or to reverse the column already sorted by */
	onSort: (field: UploadSortField) => void;

	/** Callback to select or deselect every file on the page. Omitting it hides
	 * the selection column. */
	onSelectAll?: () => void;

	/** The column the list is sorted by, if any */
	sort: UploadSortField | undefined;
};

/**
 * The column headers for the upload table.
 *
 * The selection and action columns carry no visible label, so each is named for
 * assistive technology instead of leaving a header cell empty. The select-all
 * checkbox names its own cell.
 */
export default function UploadTableHead({
	checked,
	direction,
	onSelectAll,
	onSort,
	sort,
}: UploadTableHeadProps) {
	return (
		<thead className="bg-gray-50 text-sm text-gray-600">
			<tr>
				{onSelectAll && (
					<th className="w-12" scope="col">
						<span className="sr-only">Select</span>
						<Checkbox
							ariaLabel="Select all files"
							checked={checked}
							id="UploadSelectAll"
							onClick={onSelectAll}
						/>
					</th>
				)}
				<SortableHead
					direction={direction}
					field="name"
					onSort={onSort}
					sort={sort}
				>
					Name
				</SortableHead>
				<SortableHead
					className="w-48"
					direction={direction}
					field="user"
					onSort={onSort}
					sort={sort}
				>
					User
				</SortableHead>
				<SortableHead
					className="w-48"
					direction={direction}
					field="createdAt"
					onSort={onSort}
					sort={sort}
				>
					Created At
				</SortableHead>
				<SortableHead
					className="w-48"
					direction={direction}
					field="size"
					onSort={onSort}
					sort={sort}
				>
					Size
				</SortableHead>
				<th className="w-32" scope="col">
					<span className="sr-only">Actions</span>
				</th>
			</tr>
		</thead>
	);
}
