import Button from "@base/Button";
import Icon from "@base/Icon";
import ListHeader from "@base/ListHeader";
import type { Label, Sample, SampleMinimal } from "@virtool/contracts";
import { AreaChart } from "lucide-react";
import SampleLabelsSelector from "./SampleLabelsSelector";

type SampleListHeaderProps = {
	/** The number of samples matching the current filters */
	found: number;

	/** Every label that exists */
	labels: Label[];

	/** Callback receiving the patched samples after a bulk label edit */
	onLabelsUpdated: (samples: Sample[]) => void;

	/** Callback to open a quick analysis scoped to the selected samples */
	onQuickAnalyze: () => void;

	/** The selected samples, which the bulk actions apply to */
	selectedSamples: SampleMinimal[];
};

/**
 * The bar above the samples table. Shows the sample count until samples are
 * selected, then swaps in the actions that apply to the selection.
 */
export default function SampleListHeader({
	found,
	labels,
	onLabelsUpdated,
	onQuickAnalyze,
	selectedSamples,
}: SampleListHeaderProps) {
	const selectedCount = selectedSamples.length;

	return (
		<ListHeader
			label={
				selectedCount
					? `${selectedCount} selected`
					: `${found} ${found === 1 ? "sample" : "samples"}`
			}
		>
			{selectedCount > 0 && (
				<>
					<SampleLabelsSelector
						labels={labels}
						onLabelsUpdated={onLabelsUpdated}
						selectedSamples={selectedSamples}
					/>
					<Button color="blue" size="small" onClick={onQuickAnalyze}>
						<Icon icon={AreaChart} /> Analyze
					</Button>
				</>
			)}
		</ListHeader>
	);
}
