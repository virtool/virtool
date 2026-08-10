import Button from "@base/Button";
import Checkbox from "@base/Checkbox";
import Icon from "@base/Icon";
import type { Label, Sample, SampleMinimal } from "@virtool/contracts";
import { AreaChart } from "lucide-react";
import SampleLabelsSelector from "./SampleLabelsSelector";

type SampleListHeaderProps = {
	/** Whether every, some, or no sample on the page is selected */
	checked: boolean | "indeterminate";

	/** The number of samples matching the current filters */
	found: number;

	/** Every label that exists */
	labels: Label[];

	/** Callback receiving the patched samples after a bulk label edit */
	onLabelsUpdated: (samples: Sample[]) => void;

	/** Callback to select or deselect every sample on the page */
	onSelectAll: () => void;

	/** Callback to open a quick analysis scoped to the selected samples */
	onQuickAnalyze: () => void;

	/** The selected samples, which the bulk actions apply to */
	selectedSamples: SampleMinimal[];
};

/**
 * The header for the samples list. Shows the sample count until samples are
 * selected, then swaps in the actions that apply to the selection.
 */
export default function SampleListHeader({
	checked,
	found,
	labels,
	onLabelsUpdated,
	onSelectAll,
	onQuickAnalyze,
	selectedSamples,
}: SampleListHeaderProps) {
	const selectedCount = selectedSamples.length;

	return (
		<div className="flex items-center gap-4 bg-gray-50 px-4 h-14 text-sm font-medium text-gray-600">
			<Checkbox
				ariaLabel="Select all samples"
				checked={checked}
				id="SampleSelectAll"
				onClick={onSelectAll}
			/>
			<span>
				{selectedCount
					? `${selectedCount} selected`
					: `${found} ${found === 1 ? "sample" : "samples"}`}
			</span>
			{selectedCount > 0 && (
				<div className="ml-auto flex items-center gap-2">
					<SampleLabelsSelector
						labels={labels}
						onLabelsUpdated={onLabelsUpdated}
						selectedSamples={selectedSamples}
					/>
					<Button color="blue" size="small" onClick={onQuickAnalyze}>
						<Icon icon={AreaChart} /> Analyze
					</Button>
				</div>
			)}
		</div>
	);
}
