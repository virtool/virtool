import Box from "@base/Box";
import ErrorState from "@base/ErrorState";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import { useFetchJob } from "@jobs/queries";
import type { AnalysisJobNested } from "@virtool/contracts";

type AnalysisNotReadyProps = {
	/** The job that runs the analysis workflow. */
	job: AnalysisJobNested | null;
};

const messages: Record<string, string> = {
	cancelled: "Analysis cancelled",
	failed: "Analysis failed",
	succeeded: "Analysis did not finish",
};

/**
 * What the analysis page shows in place of results that aren't ready.
 *
 * Reads the job through its own query because job changes don't refresh the
 * cached analysis, so the nested state goes stale. A succeeded job whose
 * analysis is still unready never finalized, and nothing will make it ready.
 */
export default function AnalysisNotReady({ job }: AnalysisNotReadyProps) {
	const { data: liveJob } = useFetchJob(
		job?.id ?? Number.NaN,
		job ?? undefined,
	);
	const state = liveJob?.state ?? job?.state;
	const message = state === undefined ? undefined : messages[state];

	if (job === null || message === undefined) {
		return (
			<Box>
				<LoadingPlaceholder className="mt-5" message="Analysis in progress" />
			</Box>
		);
	}

	return (
		<ErrorState message={message}>
			{state === "succeeded" ? (
				<p>The job succeeded, but its results were not saved.</p>
			) : null}
			<Link to="/jobs/$jobId" params={{ jobId: String(job.id) }}>
				View job
			</Link>
		</ErrorState>
	);
}
