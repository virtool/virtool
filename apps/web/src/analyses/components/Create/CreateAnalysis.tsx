import { Dialog, DialogTitle } from "@base/Dialog";
import type { HmmSearchResult } from "@virtool/contracts";
import CreateAnalysisBody from "./CreateAnalysisBody";
import CreateAnalysisDialogContent from "./CreateAnalysisDialogContent";

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
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<CreateAnalysisDialogContent>
				<DialogTitle>Analyze</DialogTitle>
				<CreateAnalysisBody
					hmms={hmms}
					onClose={() => setOpen(false)}
					sampleCount={1}
					sampleIds={[sampleId]}
				/>
			</CreateAnalysisDialogContent>
		</Dialog>
	);
}
