import Box from "@base/Box";
import { buttonVariants } from "@base/buttonVariants";
import ContainerNarrow from "@base/ContainerNarrow";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { useListHmms } from "@hmm/queries";
import { useCheckCanEditSample } from "@samples/hooks";
import { useFetchSample } from "@samples/queries";
import { Microscope } from "lucide-react";
import { useState } from "react";
import { useListAnalyses } from "../queries";
import AnalysisItem from "./AnalysisItem";
import CreateAnalysis from "./Create/CreateAnalysis";
import AnalysisHmmAlert from "./HmmAlert";

type AnalysesListProps = {
	onPageChange: (page: number) => void;
	page: number;
	sampleId: number;
};

/**
 * A list of analyses with filtering options
 */
export default function AnalysesList({
	onPageChange,
	page,
	sampleId,
}: AnalysesListProps) {
	const [openCreateAnalysis, setOpenCreateAnalysis] = useState(false);
	const {
		data: analyses,
		isPending: isPendingAnalyses,
		isError: isErrorAnalyses,
	} = useListAnalyses(sampleId, page, 25);
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

	return (
		<ContainerNarrow>
			<AnalysisHmmAlert
				installed={Boolean(
					hmms.status.installed?.ready ?? hmms.status.task?.complete,
				)}
			/>
			<div className="flex justify-end pb-4">
				{canCreate && (
					<button
						type="button"
						className={buttonVariants({ color: "blue" })}
						onClick={() => setOpenCreateAnalysis(true)}
					>
						Create
					</button>
				)}
			</div>
			{analyses.foundCount ? (
				<Pagination
					storedPage={analyses.page}
					currentPage={page}
					pageCount={analyses.pageCount}
					onPageChange={onPageChange}
				>
					<ul className="list-none">
						{analyses.items.map((item) => (
							<AnalysisItem key={item.id} analysis={item} />
						))}
					</ul>
				</Pagination>
			) : (
				<Box>
					<Empty className="h-72">
						<EmptyMedia className="text-gray-400">
							<Microscope size={40} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No analyses found</EmptyTitle>
						<EmptyDescription>
							This sample has no analyses yet.
						</EmptyDescription>
					</Empty>
				</Box>
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
