import { Dialog, DialogTitle } from "@base/Dialog";
import QueryError from "@base/QueryError";
import { useListHmms } from "@hmm/queries";
import type { SampleMinimal } from "@virtool/contracts";
import CreateAnalysisBody from "./CreateAnalysisBody";
import CreateAnalysisDialogContent from "./CreateAnalysisDialogContent";
import { SelectedSamples } from "./SelectedSamples";

type QuickAnalyzeContentProps = {
	fromSelection: boolean;
	onClose: () => void;
	samples: SampleMinimal[];
};

/**
 * Keep data requests inside the dialog content so they start together on open.
 */
function QuickAnalyzeContent({
	fromSelection,
	onClose,
	samples,
}: QuickAnalyzeContentProps) {
	const { data: hmms, isError } = useListHmms(1, 1, "");

	const sampleIds = samples.map((sample) => sample.id);

	return (
		<>
			<DialogTitle>Quick Analyze</DialogTitle>
			<SelectedSamples fromSelection={fromSelection} samples={samples} />
			{isError && !hmms ? (
				<QueryError noun="HMMs" />
			) : (
				<CreateAnalysisBody
					hmms={hmms}
					onClose={onClose}
					sampleCount={sampleIds.length}
					sampleIds={sampleIds}
				/>
			)}
		</>
	);
}

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
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<CreateAnalysisDialogContent>
				<QuickAnalyzeContent
					fromSelection={fromSelection}
					onClose={() => setOpen(false)}
					samples={samples}
				/>
			</CreateAnalysisDialogContent>
		</Dialog>
	);
}
