import NuvsViewer from "@analyses/components/Nuvs/NuvsViewer";
import { analysesQueryKeys } from "@analyses/keys";
import { formatDate, formatTime } from "@app/date";
import { getWorkflowDisplayName } from "@app/utils";
import Box from "@base/Box";
import CopyText from "@base/CopyText";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import {
	SubviewHeader,
	SubviewHeaderAttribution,
	SubviewHeaderTitle,
} from "@base/Subview";
import { useTimeText } from "@base/Time";
import { useFetchJob } from "@jobs/queries";
import { useFetchSample } from "@samples/queries";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { Analysis, JobState, Sample } from "@virtool/contracts";
import { CircleAlert } from "lucide-react";
import { Suspense, useEffect } from "react";
import { useGetAnalysis, useSuspenseAnalysisResults } from "../queries";
import type {
	FormattedNuvsAnalysis,
	FormattedPathoscopeAnalysis,
} from "../types";
import { getWorkflowVersionLabel } from "../utils";
import { PathoscopeViewer } from "./Pathoscope/PathoscopeViewer";

const unsuccessfulMessages: Partial<Record<JobState, string>> = {
	cancelled: "Analysis cancelled",
	failed: "Analysis failed",
};

const routeApi = getRouteApi(
	"/_authenticated/samples/$sampleId/analyses/$analysisId",
);

/** Base component viewing all supported analysis */
export default function AnalysisDetail() {
	const { analysisId, sampleId } = routeApi.useParams();
	const queryClient = useQueryClient();
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
	const { data: job } = useFetchJob(
		analysis?.job?.id ?? Number.NaN,
		analysis?.job ?? undefined,
	);

	// The analysis and job queries refetch independently, so the job can show
	// success while the cached analysis is still unready from before it was
	// finalized. Refetch the analysis to learn whether it is truly unfinished.
	const isAnalysisBehindJob =
		analysis !== undefined &&
		!analysis.ready &&
		job?.state === "succeeded" &&
		analysis.job?.state !== "succeeded";

	useEffect(() => {
		if (isAnalysisBehindJob) {
			queryClient.invalidateQueries({
				queryKey: analysesQueryKeys.detail(Number(analysisId)),
			});
		}
	}, [analysisId, isAnalysisBehindJob, queryClient]);

	if ((isError && !analysis) || (isSampleError && !sample)) {
		return <QueryError noun="analysis" />;
	}

	if (isPending || isPendingSample) {
		return <LoadingPlaceholder />;
	}

	if (!analysis.ready) {
		// Neither source is reliably fresher. A cached job can stay pinned at
		// `running` by its seed, and no job event invalidates the analysis. An
		// unsuccessful state is permanent, so either source can settle it.
		// Success settles it only when read with `ready` in the same record:
		// the pod finalizes the analysis before it finishes the job, so that
		// record cannot show a succeeded job beside a stale `ready`.
		const endMessage =
			[job?.state, analysis.job?.state]
				.map((state) => (state ? unsuccessfulMessages[state] : undefined))
				.find(Boolean) ??
			(analysis.job?.state === "succeeded"
				? "Analysis did not finish"
				: undefined);

		if (analysis.job && endMessage) {
			return (
				<Box className="flex justify-center items-center">
					<CircleAlert className="mr-1" />
					<span>{endMessage}</span>
					<Link
						className="ml-2"
						to="/jobs/$jobId"
						params={{ jobId: String(analysis.job.id) }}
					>
						View job
					</Link>
				</Box>
			);
		}

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
					{analysis.user.username} started{" "}
					<CreatedAt time={analysis.createdAt} /> · Workflow Version{" "}
					<WorkflowVersion analysis={analysis} />
				</SubviewHeaderAttribution>
			</SubviewHeader>

			<Suspense fallback={<LoadingPlaceholder />}>
				<AnalysisResults analysis={analysis} sample={sample} />
			</Suspense>
		</div>
	);
}

type CreatedAtProps = {
	/** The instant the analysis was started. */
	time: Date;
};

/**
 * The start time in the format the user prefers, clickable to copy the exact
 * instant in a form Excel reads as a date — `yyyy-MM-dd HH:mm:ss` in the
 * reader's own time zone.
 *
 * The copy button takes the place of the tooltip that other times have.
 */
function CreatedAt({ time }: CreatedAtProps) {
	const text = useTimeText(time, { sentence: true });
	const value = `${formatDate(time)} ${formatTime(time)}`;

	if (text === null) {
		return null;
	}

	return (
		<>
			{text.prefix}
			<CopyText tag="analysis-created-at" value={value}>
				<time
					className={text.placeholder ? "invisible" : undefined}
					dateTime={time.toISOString()}
				>
					{text.primary}
				</time>
			</CopyText>
		</>
	);
}

type WorkflowVersionProps = {
	/** A finished analysis. */
	analysis: Analysis;
};

/**
 * The finalizing workflow version, clickable to copy the raw value.
 *
 * Only a real version is worth copying, so the absences — an unrecorded `null`
 * and a captured `"UNKNOWN"` — stay plain text.
 */
function WorkflowVersion({ analysis }: WorkflowVersionProps) {
	const version = analysis.workflowVersion;
	const label = getWorkflowVersionLabel(analysis);

	if (version === null || version === "UNKNOWN") {
		return <>{label}</>;
	}

	return (
		<CopyText tag="workflow-version" value={version}>
			{label}
		</CopyText>
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
