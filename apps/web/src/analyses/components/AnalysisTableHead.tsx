import SortableHead from "@base/SortableHead";
import { TableActionsHead, TableHead } from "@base/Table";
import type { AnalysisSortField, SortDirection } from "@virtool/contracts";

type AnalysisTableHeadProps = {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** Callback to sort by a column, or to reverse the column already sorted by */
	onSort: (field: AnalysisSortField) => void;

	/** The column the list is sorted by, if any */
	sort: AnalysisSortField | undefined;
};

/**
 * The column headers for the analysis table.
 *
 * Reference and Subtractions are not sortable: each names a relation rather than
 * a column, and an analysis can carry several subtractions, so there is no
 * single value to order the list by.
 */
export default function AnalysisTableHead({
	direction,
	onSort,
	sort,
}: AnalysisTableHeadProps) {
	return (
		<TableHead>
			<SortableHead
				direction={direction}
				field="workflow"
				onSort={onSort}
				sort={sort}
			>
				Workflow
			</SortableHead>
			<th scope="col">Reference</th>
			<th scope="col">Subtractions</th>
			<SortableHead
				className="w-40"
				direction={direction}
				field="user"
				onSort={onSort}
				sort={sort}
			>
				User
			</SortableHead>
			<SortableHead
				className="w-40"
				direction={direction}
				field="createdAt"
				onSort={onSort}
				sort={sort}
			>
				Created
			</SortableHead>
			<TableActionsHead className="w-24" />
		</TableHead>
	);
}
