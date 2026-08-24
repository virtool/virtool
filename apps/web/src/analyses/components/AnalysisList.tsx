import type { AnalysesListSearch } from "@analyses/listSearch";
import { pluralize } from "@app/format";
import { BoxGroup, BoxGroupTable } from "@base/Box";
import Button, { buttonVariants } from "@base/Button";
import { ContainerNarrow } from "@base/Container";
import ListEmpty from "@base/ListEmpty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { nextSortDirection } from "@base/sorting";
import { useListHmms } from "@hmm/queries";
import { useCheckCanEditSample } from "@samples/hooks";
import { useFetchSample } from "@samples/queries";
import type { AnalysisSortField, AnalysisWorkflow } from "@virtool/contracts";
import { xor } from "es-toolkit/array";
import { Microscope, SearchX } from "lucide-react";
import { useState } from "react";
import { useListAnalyses } from "../queries";
import AnalysisItem from "./AnalysisItem";
import AnalysisTableHead from "./AnalysisTableHead";
import CreateAnalysis from "./Create/CreateAnalysis";
import FilterBar from "./Filter/FilterBar";
import AnalysisHmmAlert from "./HmmAlert";

type AnalysesListProps = {
	/** The direction the sorted column is ordered in */
	direction: AnalysesListSearch["direction"];

	page: number;
	sampleId: number;

	/** Updates the params the list reads its page, ordering, and filters from */
	setSearch: (next: Partial<AnalysesListSearch>) => void;

	/** The column the list is sorted by, or undefined for newest first */
	sort?: AnalysisSortField;

	/** The ids of the users whose analyses are shown, or empty for every user */
	users: number[];

	/** The workflows whose analyses are shown, or empty for every workflow */
	workflows: AnalysisWorkflow[];
};

/**
 * A sample's analyses, as a sortable table.
 */
export default function AnalysesList({
	direction,
	page,
	sampleId,
	setSearch,
	sort,
	users,
	workflows,
}: AnalysesListProps) {
	const [openCreateAnalysis, setOpenCreateAnalysis] = useState(false);
	const {
		data: analyses,
		isPending: isPendingAnalyses,
		isError: isErrorAnalyses,
	} = useListAnalyses({
		direction,
		page,
		perPage: 25,
		sampleId,
		sort,
		userIds: users,
		workflows,
	});
	const {
		data: hmms,
		isPending: isPendingHmms,
		isError: isErrorHmms,
	} = useListHmms(1, 25);
	const {
		data: sample,
		isPending: isPendingSample,
		isError: isErrorSample,
	} = useFetchSample(sampleId);
	const { hasPermission: canCreate } = useCheckCanEditSample(sampleId);

	if (
		(isErrorAnalyses && !analyses) ||
		(isErrorHmms && !hmms) ||
		(isErrorSample && !sample)
	) {
		return <QueryError noun="analyses" />;
	}

	if (
		isPendingAnalyses ||
		isPendingHmms ||
		isPendingSample ||
		!analyses ||
		!hmms
	) {
		return <LoadingPlaceholder />;
	}

	function handleSort(field: AnalysisSortField) {
		setSearch({
			direction: nextSortDirection(field, sort, direction),
			page: 1,
			sort: field,
		});
	}

	// An empty list means "nothing analysed yet" only when nothing is narrowing
	// it. Otherwise the analyses exist and the filters are hiding them.
	const isFiltered = users.length > 0 || workflows.length > 0;

	const createButton = canCreate ? (
		<button
			type="button"
			className={buttonVariants({ color: "blue" })}
			onClick={() => setOpenCreateAnalysis(true)}
		>
			Create
		</button>
	) : null;

	return (
		<ContainerNarrow>
			<AnalysisHmmAlert
				installed={Boolean(
					hmms.status.installed?.ready ?? hmms.status.task?.complete,
				)}
			/>
			<div className="mb-3 flex min-h-9 flex-wrap items-center gap-4">
				<FilterBar
					onClearUsers={() => setSearch({ page: 1, users: [] })}
					onClearWorkflows={() => setSearch({ page: 1, workflows: [] })}
					onToggleUser={(userId) =>
						setSearch({ page: 1, users: xor(users, [userId]) })
					}
					onToggleWorkflow={(workflow) =>
						setSearch({ page: 1, workflows: xor(workflows, [workflow]) })
					}
					selectedUsers={users}
					selectedWorkflows={workflows}
				/>
				<span className="text-sm font-medium text-gray-600">
					Showing {analyses.foundCount} of{" "}
					{pluralize(analyses.totalCount, "analysis", "analyses")}
				</span>
				{createButton ? <div className="ml-auto">{createButton}</div> : null}
			</div>
			{analyses.foundCount ? (
				<Pagination
					storedPage={analyses.page}
					currentPage={page}
					pageCount={analyses.pageCount}
					onPageChange={(page) => setSearch({ page })}
				>
					<BoxGroup>
						<BoxGroupTable variant="data">
							<caption className="sr-only">Analyses</caption>
							<AnalysisTableHead
								direction={direction}
								onSort={handleSort}
								sort={sort}
							/>
							<tbody>
								{analyses.items.map((item) => (
									<AnalysisItem key={item.id} analysis={item} />
								))}
							</tbody>
						</BoxGroupTable>
					</BoxGroup>
				</Pagination>
			) : (
				<ListEmpty
					description={
						isFiltered
							? "No analyses match the current filters."
							: "This sample has no analyses yet."
					}
					icon={isFiltered ? SearchX : Microscope}
					title={isFiltered ? "No matching analyses" : "No analyses found"}
				>
					{isFiltered && (
						<Button
							onClick={() => setSearch({ page: 1, users: [], workflows: [] })}
							size="small"
						>
							Clear filters
						</Button>
					)}
				</ListEmpty>
			)}

			<CreateAnalysis
				hmms={hmms}
				open={openCreateAnalysis}
				setOpen={setOpenCreateAnalysis}
				sampleId={sampleId}
			/>
		</ContainerNarrow>
	);
}
