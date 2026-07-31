import NuvsViewer from "@analyses/components/Nuvs/NuvsViewer";
import { getWorkflowDisplayName } from "@app/utils";
import Box from "@base/Box";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import RelativeTime from "@base/RelativeTime";
import SubviewHeader from "@base/SubviewHeader";
import SubviewHeaderAttribution from "@base/SubviewHeaderAttribution";
import SubviewHeaderTitle from "@base/SubviewHeaderTitle";
import { useFetchSample } from "@samples/queries";
import { getRouteApi } from "@tanstack/react-router";
import type { Analysis, Sample } from "@virtool/contracts";
import { CircleAlert } from "lucide-react";
import { Suspense } from "react";
import { useGetAnalysis, useSuspenseAnalysisResults } from "../queries";
import type {
	FormattedNuvsAnalysis,
	FormattedPathoscopeAnalysis,
} from "../types";
import { PathoscopeViewer } from "./Pathoscope/PathoscopeViewer";

const routeApi = getRouteApi(
	"/_authenticated/samples/$sampleId/analyses/$analysisId",
);

/** Base component viewing all supported analysis */
export default function AnalysisDetail() {
	const { analysisId, sampleId } = routeApi.useParams();
	const {
		data: analysis,
		isPending,
		isError,
	} = useGetAnalysis(Number(analysisId));
	const {
		data: sample,
		isPending: isPendingSample,
		isError: isSampleError,
	} = useFetchSample(Number(sampleId));

	if ((isError && !analysis) || (isSampleError && !sample)) {
		return <QueryError noun="analysis" />;
	}

	if (isPending || isPendingSample) {
		return <LoadingPlaceholder />;
	}

	if (!analysis.ready) {
		return (
			<Box>
				<LoadingPlaceholder className="mt-5" message="Analysis in progress" />
			</Box>
		);
	}

	if (analysis.workflow !== "pathoscope" && analysis.workflow !== "nuvs") {
		return (
			<Box className="flex justify-center items-center">
				<CircleAlert className="mr-1" />
				Workflow not supported.
			</Box>
		);
	}

	return (
		<div>
			<SubviewHeader>
				<SubviewHeaderTitle>
					{getWorkflowDisplayName(analysis.workflow)} for {sample.name}
				</SubviewHeaderTitle>
				<SubviewHeaderAttribution>
					{analysis.user.handle} started{" "}
					<RelativeTime time={analysis.createdAt} />
				</SubviewHeaderAttribution>
			</SubviewHeader>

			<Suspense fallback={<LoadingPlaceholder />}>
				<AnalysisResults analysis={analysis} sample={sample} />
			</Suspense>
		</div>
	);
}

type AnalysisResultsProps = {
	/** A finished analysis, without its results. */
	analysis: Analysis & { workflow: "nuvs" | "pathoscope" };

	/** The sample the analysis was run on. */
	sample: Sample;
};

/**
 * The workflow's viewer, rendered once the analysis's results have loaded.
 *
 * Suspends on the results rather than the route blocking on them, so the header
 * above renders as soon as the analysis metadata arrives instead of waiting on
 * the whole document.
 */
function AnalysisResults({ analysis, sample }: AnalysisResultsProps) {
	const { data: results } = useSuspenseAnalysisResults(analysis.id);

	// The server shapes `results` per workflow but types it as an opaque
	// `JsonObject`, so the workflow check is what narrows it here.
	if (analysis.workflow === "pathoscope") {
		return (
			<PathoscopeViewer
				analysis={
					{ ...analysis, results } as unknown as FormattedPathoscopeAnalysis
				}
				sample={sample}
			/>
		);
	}

	return (
		<NuvsViewer
			detail={{ ...analysis, results } as unknown as FormattedNuvsAnalysis}
			sample={sample}
		/>
	);
}
