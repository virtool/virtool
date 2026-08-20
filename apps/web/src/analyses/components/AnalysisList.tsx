import { pluralize } from "@app/format";
import BoxGroup from "@base/BoxGroup";
import BoxGroupTable from "@base/BoxGroupTable";
import { buttonVariants } from "@base/buttonVariants";
import ContainerNarrow from "@base/ContainerNarrow";
import ListEmpty from "@base/ListEmpty";
import ListHeader from "@base/ListHeader";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { nextSortDirection } from "@base/sorting";
import { useListHmms } from "@hmm/queries";
import { useCheckCanEditSample } from "@samples/hooks";
import { useFetchSample } from "@samples/queries";
import type { AnalysisSortField, SortDirection } from "@virtool/contracts";
import { Microscope } from "lucide-react";
import { useState } from "react";
import { useListAnalyses } from "../queries";
import AnalysisItem from "./AnalysisItem";
import AnalysisTableHead from "./AnalysisTableHead";
import CreateAnalysis from "./Create/CreateAnalysis";
import AnalysisHmmAlert from "./HmmAlert";

type AnalysesListProps = {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	onPageChange: (page: number) => void;

	/** Called with the column to order by and the direction to order it in */
	onSortChange: (sort: AnalysisSortField, direction: SortDirection) => void;

	page: number;
	sampleId: number;

	/** The column the list is sorted by, or undefined for newest first */
	sort?: AnalysisSortField;
};

/**
 * A sample's analyses, as a sortable table.
 */
export default function AnalysesList({
	direction,
	onPageChange,
	onSortChange,
	page,
	sampleId,
	sort,
}: AnalysesListProps) {
	const [openCreateAnalysis, setOpenCreateAnalysis] = useState(false);
	const {
		data: analyses,
		isPending: isPendingAnalyses,
		isError: isErrorAnalyses,
	} = useListAnalyses(sampleId, page, 25, sort, direction);
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
		onSortChange(field, nextSortDirection(field, sort, direction));
	}

	const createButton = canCreate ? (
		<button
			type="button"
			className={buttonVariants({ color: "blue", size: "small" })}
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
			{analyses.foundCount ? (
				<Pagination
					storedPage={analyses.page}
					currentPage={page}
					pageCount={analyses.pageCount}
					onPageChange={onPageChange}
				>
					<BoxGroup>
						<ListHeader
							label={pluralize(analyses.foundCount, "analysis", "analyses")}
						>
							{createButton}
						</ListHeader>
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
					description="This sample has no analyses yet."
					icon={Microscope}
					title="No analyses found"
				>
					{createButton}
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
