import type { FormattedPathoscopeAnalysis } from "@analyses/types";
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
	return (
		<>
			<AnalysisMapping
				detail={analysis}
				totalReads={sample.quality?.count ?? 0}
			/>
			<PathoscopeToolbar analysis={analysis} />
			<PathoscopeList analysis={analysis} />
			<PathoscopeViewerScroller />
		</>
	);
}
