import NuvsList from "@analyses/components/Nuvs/NuvsList";
import NuvsToolbar from "@analyses/components/Nuvs/NuvsToolbar";
import type { FormattedNuvsAnalysis } from "@analyses/types";
import type { Sample } from "@virtool/contracts";

type NuvsViewerProps = {
	/** Complete Nuvs analysis details */
	detail: FormattedNuvsAnalysis;
	/** The sample that was analysed */
	sample: Sample;
};

/**
 * Detailed breakdown of the results of a Nuvs analysis
 */
export default function NuvsViewer({ detail, sample }: NuvsViewerProps) {
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
