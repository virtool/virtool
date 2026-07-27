import NuvsList from "@analyses/components/Nuvs/NuvsList";
import NuvsToolbar from "@analyses/components/Nuvs/NuvsToolbar";
import type { FormattedNuvsAnalysis } from "@analyses/types";
import type { Sample } from "@virtool/contracts";

type NuVsViewerProps = {
	/** Complete Nuvs analysis details */
	detail: FormattedNuvsAnalysis;
	/** The sample that was analysed */
	sample: Sample;
};

/**
 * Detailed breakdown of the results of a Nuvs analysis
 */
export default function NuvsViewer({ detail, sample }: NuVsViewerProps) {
	return (
		<div>
			<NuvsToolbar
				analysisId={detail.id}
				results={detail.results}
				sampleName={sample.name}
			/>
			<NuvsList detail={detail} />
		</div>
	);
}
