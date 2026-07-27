import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import Alert from "@base/Alert";
import type { Sample } from "@virtool/contracts";
import { PathoscopeList } from "./PathoscopeList";
import { AnalysisMapping } from "./PathoscopeMapping";
import { PathoscopeToolbar } from "./PathoscopeToolbar";
import { PathoscopeViewerScroller } from "./PathoscopeViewScroller";

type PathoscopeViewerProps = {
	/** A pathoscope analysis. */
	analysis: FormattedPathoscopeAnalysis;

	/** The sample that was analysed */
	sample: Sample;
};

/** Detailed breakdown of the results of a pathoscope analysis */
export function PathoscopeViewer({ analysis, sample }: PathoscopeViewerProps) {
	const { search } = useAnalysisSearch();
	const showReads = search.reads ?? false;

	return (
		<>
			<AnalysisMapping
				detail={analysis}
				totalReads={sample.quality?.count ?? 0}
			/>
			<PathoscopeToolbar analysisId={analysis.id} />
			{showReads && (
				<Alert color="orange" level>
					<div>
						<p className="font-bold">Read Numbers are not realistic.</p>
						<p>
							Read numbers are arbitrarily calculated using weight × total
							mapped reads and are not representative of actual numbers of reads
							mapped to viruses.
						</p>
						<p>Read numbers are shown only for continuity.</p>
					</div>
				</Alert>
			)}
			<PathoscopeList analysis={analysis} sample={sample} />
			<PathoscopeViewerScroller />
		</>
	);
}
