import { Dialog, DialogTitle } from "@base/Dialog";
import QueryError from "@base/QueryError";
import { useListHmms } from "@hmm/queries";
import type { SampleMinimal } from "@virtool/contracts";
import HmmAlert from "../HmmAlert";
import CreateAnalysisDialogContent from "./CreateAnalysisDialogContent";
import CreateAnalysisForm from "./CreateAnalysisForm";
import { SelectedSamples } from "./SelectedSamples";
import { getCompatibleWorkflows } from "./workflows";

type QuickAnalyzeProps = {
	/** Whether the samples came from the list selection rather than a single sample */
	fromSelection: boolean;

	open: boolean;
	setOpen: (open: boolean) => void;

	/** The samples to analyze */
	samples: SampleMinimal[];
};

/**
 * A form for triggering quick analyses on the passed samples
 */
export default function QuickAnalyze({
	fromSelection,
	open,
	samples,
	setOpen,
}: QuickAnalyzeProps) {
	const { data: hmms, isPending, isError } = useListHmms(1, 1, "");

	if (isError && !hmms) {
		return (
			<Dialog open={open} onOpenChange={setOpen}>
				<CreateAnalysisDialogContent>
					<DialogTitle>Quick Analyze</DialogTitle>
					<QueryError noun="HMMs" />
				</CreateAnalysisDialogContent>
			</Dialog>
		);
	}

	if (isPending) {
		return null;
	}

	const compatibleWorkflows = getCompatibleWorkflows(hmms.total_count > 0);

	const sampleIds = samples.map((sample) => sample.id);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<CreateAnalysisDialogContent>
				<DialogTitle>Quick Analyze</DialogTitle>
				<HmmAlert installed={Boolean(hmms.status.task?.complete)} />

				<SelectedSamples fromSelection={fromSelection} samples={samples} />

				<CreateAnalysisForm
					compatibleWorkflows={compatibleWorkflows}
					onClose={() => setOpen(false)}
					sampleCount={sampleIds.length}
					sampleIds={sampleIds}
				/>
			</CreateAnalysisDialogContent>
		</Dialog>
	);
}
