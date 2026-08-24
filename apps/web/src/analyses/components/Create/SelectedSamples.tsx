import { cn } from "@app/cn";
import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import type { SampleMinimal } from "@virtool/contracts";
import CreateAnalysisFieldTitle from "./CreateAnalysisFieldTitle";

type SelectedSamplesProps = {
	/** The samples selected for the open quick analysis dialog. */
	samples: SampleMinimal[];

	/**
	 * Whether the samples came from the list selection rather than a single
	 * sample. A selection is titled in the plural, counted even when only one
	 * sample is in it, and scrolls once it outgrows the dialog.
	 */
	fromSelection: boolean;
};

/**
 * Displays the sample selected for the analyses that will be started by the open
 * quick analysis dialog.
 */
export function SelectedSamples({
	fromSelection,
	samples,
}: SelectedSamplesProps) {
	return (
		<div className="mb-6">
			<CreateAnalysisFieldTitle>
				{fromSelection ? (
					<>
						Selected Samples <Badge>{samples.length}</Badge>
					</>
				) : (
					"Selected Sample"
				)}
			</CreateAnalysisFieldTitle>
			<div
				className={cn("border", "border-gray-300", "rounded-sm", {
					"max-h-32 overflow-y-scroll": fromSelection,
				})}
			>
				{samples.map(({ id, name }) => (
					<BoxGroupSection key={id}>{name}</BoxGroupSection>
				))}
			</div>
		</div>
	);
}
