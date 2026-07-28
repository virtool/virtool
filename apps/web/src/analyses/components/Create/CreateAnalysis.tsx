import { Dialog, DialogTitle } from "@base/Dialog";
import type { HmmSearchResult } from "@virtool/contracts";
import HmmAlert from "../HmmAlert";
import CreateAnalysisDialogContent from "./CreateAnalysisDialogContent";
import CreateAnalysisForm from "./CreateAnalysisForm";
import { getCompatibleWorkflows } from "./workflows";

type CreateAnalysisProps = {
	/** The HMM search results */
	hmms: HmmSearchResult;

	open: boolean;

	setOpen: (open: boolean) => void;

	/** The id of the sample being used */
	sampleId: number;
};

/**
 * Dialog for creating an analysis
 */
export default function CreateAnalysis({
	hmms,
	open,
	setOpen,
	sampleId,
}: CreateAnalysisProps) {
	const compatibleWorkflows = getCompatibleWorkflows(Boolean(hmms.totalCount));

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<CreateAnalysisDialogContent>
				<DialogTitle>Analyze</DialogTitle>
				<HmmAlert installed={Boolean(hmms.status.task?.complete)} />
				<CreateAnalysisForm
					compatibleWorkflows={compatibleWorkflows}
					onClose={() => setOpen(false)}
					sampleCount={1}
					sampleIds={[sampleId]}
				/>
			</CreateAnalysisDialogContent>
		</Dialog>
	);
}
