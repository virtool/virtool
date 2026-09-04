import { useCreateAnalysisOptions } from "@analyses/hooks";
import QueryError from "@base/QueryError";
import type { HmmSearchResult } from "@virtool/contracts";
import HmmAlert from "../HmmAlert";
import CreateAnalysisForm from "./CreateAnalysisForm";
import CreateAnalysisPlaceholder from "./CreateAnalysisPlaceholder";
import { getCompatibleWorkflows } from "./workflows";

type CreateAnalysisBodyProps = {
	/** The HMM search results, or `undefined` while loading */
	hmms: HmmSearchResult | undefined;

	onClose: () => void;

	sampleCount: number;

	sampleIds: number[];
};

/**
 * Show the form once HMMs and analysis options are ready to limit dialog resizing.
 */
export default function CreateAnalysisBody({
	hmms,
	onClose,
	sampleCount,
	sampleIds,
}: CreateAnalysisBodyProps) {
	const { defaultSubtractions, indexes, subtractions, isError, isPending } =
		useCreateAnalysisOptions(sampleIds);

	if (isError) {
		return <QueryError noun="analysis options" />;
	}

	if (isPending || !hmms) {
		return <CreateAnalysisPlaceholder />;
	}

	return (
		<>
			<HmmAlert installed={Boolean(hmms.status.task?.complete)} />
			<CreateAnalysisForm
				compatibleWorkflows={getCompatibleWorkflows(hmms.totalCount > 0)}
				defaultSubtractions={defaultSubtractions}
				indexes={indexes}
				onClose={onClose}
				sampleCount={sampleCount}
				sampleIds={sampleIds}
				subtractions={subtractions}
			/>
		</>
	);
}
