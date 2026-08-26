import NuvsViewer from "@analyses/components/Nuvs/NuvsViewer";
import { writeToClipboard } from "@app/clipboard";
import { formatDate, formatTime } from "@app/date";
import { useIsSecureContext } from "@app/hooks";
import { getWorkflowDisplayName } from "@app/utils";
import Box from "@base/Box";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { useRelativeTime } from "@base/RelativeTime";
import {
	SubviewHeader,
	SubviewHeaderAttribution,
	SubviewHeaderTitle,
} from "@base/Subview";
import { toast } from "@base/useToast";
import { useFetchSample } from "@samples/queries";
import * as Sentry from "@sentry/tanstackstart-react";
import { getRouteApi } from "@tanstack/react-router";
import type { Analysis, Sample } from "@virtool/contracts";
import { CircleAlert, ClipboardPaste } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { useGetAnalysis, useSuspenseAnalysisResults } from "../queries";
import type {
	FormattedNuvsAnalysis,
	FormattedPathoscopeAnalysis,
} from "../types";
import { getWorkflowVersionLabel } from "../utils";
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
					{analysis.user.handle} started <CreatedAt time={analysis.createdAt} />{" "}
					· Workflow Version{" "}
					<WorkflowVersion version={analysis.workflowVersion} />
				</SubviewHeaderAttribution>
			</SubviewHeader>

			<Suspense fallback={<LoadingPlaceholder />}>
				<AnalysisResults analysis={analysis} sample={sample} />
			</Suspense>
		</div>
	);
}

type CopyTextProps = {
	/** What is rendered in place — the reader-facing form of the value. */
	children: ReactNode;

	/** The message shown in the toast once the value is on the clipboard. */
	message: string;

	/** A short label identifying this copy site, forwarded to Sentry on failure. */
	tag: string;

	/** The exact text written to the clipboard, which need not match `children`. */
	value: string;
};

/**
 * Inline text that copies an exact value to the clipboard when clicked.
 *
 * The rendered `children` are the friendly form and the copied `value` the exact
 * one, so a relative time can be shown while an absolute one is copied. Outside a
 * secure context, where the clipboard cannot be reached, the text renders plain.
 */
function CopyText({ children, message, tag, value }: CopyTextProps) {
	const isSecureContext = useIsSecureContext();

	if (!isSecureContext) {
		return <>{children}</>;
	}

	// Only a resolved write raises the toast, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the value was copied.
	function handleCopy() {
		writeToClipboard(value).then(
			() =>
				toast({
					description: (
						<span className="flex items-start gap-2">
							<ClipboardPaste className="mt-1 size-4 shrink-0" />
							{message}
						</span>
					),
				}),
			(error) => Sentry.captureException(error, { tags: { clipboard: tag } }),
		);
	}

	return (
		<button
			type="button"
			className="cursor-pointer underline decoration-dotted underline-offset-2"
			title="Copy to clipboard"
			onClick={handleCopy}
		>
			{children}
		</button>
	);
}

type CreatedAtProps = {
	/** The instant the analysis was started. */
	time: Date;
};

/**
 * The relative start time, clickable to copy the exact instant in a form Excel
 * reads as a date — `yyyy-MM-dd HH:mm:ss` in the reader's own time zone.
 */
function CreatedAt({ time }: CreatedAtProps) {
	const label = useRelativeTime(time);
	const value = `${formatDate(time)} ${formatTime(time)}`;

	return (
		<CopyText
			message={`"${value}" copied to clipboard.`}
			tag="analysis-created-at"
			value={value}
		>
			<time dateTime={time.toISOString()}>{label}</time>
		</CopyText>
	);
}

type WorkflowVersionProps = {
	/** The analysis's finalizing workflow version, or `null` if none was recorded. */
	version: string | null;
};

/**
 * The finalizing workflow version, clickable to copy the raw value.
 *
 * Only a real version is worth copying, so the absences — an unrecorded `null`
 * and a captured `"UNKNOWN"` — stay plain text.
 */
function WorkflowVersion({ version }: WorkflowVersionProps) {
	const label = getWorkflowVersionLabel(version);

	if (version === null || version === "UNKNOWN") {
		return <>{label}</>;
	}

	return (
		<CopyText
			message={`"${version}" copied to clipboard.`}
			tag="workflow-version"
			value={version}
		>
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
