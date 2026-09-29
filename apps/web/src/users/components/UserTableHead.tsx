import SortableHead from "@base/SortableHead";
import { TableHead } from "@base/Table";
import type { SortDirection, UserSortField } from "@virtool/contracts";

type UserTableHeadProps = {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** Callback to sort by a column, or to reverse the column already sorted by */
	onSort: (field: UserSortField) => void;

	/** The column the list is sorted by */
	sort: UserSortField;
};

/**
 * The column headers for the users table.
 *
 * Primary Group is not sortable: it names a relation rather than a column.
 */
export default function UserTableHead({
	direction,
	onSort,
	sort,
}: UserTableHeadProps) {
	return (
		<TableHead>
			<SortableHead
				direction={direction}
				field="handle"
				onSort={onSort}
				sort={sort}
			>
				Handle
			</SortableHead>
			<SortableHead
				direction={direction}
				field="email"
				onSort={onSort}
				sort={sort}
			>
				Email
			</SortableHead>
			<SortableHead
				className="w-40"
				direction={direction}
				field="role"
				onSort={onSort}
				sort={sort}
			>
				Role
			</SortableHead>
			<th className="w-48" scope="col">
				Primary Group
			</th>
			<SortableHead
				className="w-36"
				direction={direction}
				field="status"
				onSort={onSort}
				sort={sort}
			>
				Status
			</SortableHead>
		</TableHead>
	);
}
