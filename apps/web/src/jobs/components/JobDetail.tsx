import { getErrorStatus } from "@app/queryErrors";
import { getWorkflowDisplayName } from "@app/utils";
import Alert from "@base/Alert";
import ContainerNarrow from "@base/ContainerNarrow";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import RelativeTime, { useRelativeTime } from "@base/RelativeTime";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderAttribution from "@base/ViewHeaderAttribution";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { useFetchIndex } from "@indexes/queries";
import { getRouteApi } from "@tanstack/react-router";
import type { JobState } from "@virtool/contracts";
import { useFetchJob } from "../queries";
import JobArgs from "./JobArgs";
import JobSteps from "./JobSteps";

const routeApi = getRouteApi("/_authenticated/jobs/$jobId");

function getAlertColor(
	state: JobState,
): "blue" | "green" | "orange" | "red" | "purple" {
	switch (state) {
		case "failed":
			return "red";
		case "pending":
			return "purple";
		case "running":
			return "green";
		case "succeeded":
			return "blue";
		case "cancelled":
			return "orange";
	}
}

function PendingJobAlert({ createdAt }: { createdAt: Date }) {
	const pendingTime = useRelativeTime(createdAt, { addSuffix: false });

	return (
		<Alert color="purple">
			<div>
				<div>Job pending for {pendingTime}.</div>
				<div className="mt-1">The job is waiting for an available runner.</div>
			</div>
		</Alert>
	);
}

/**
 * The job detailed view
 */
export default function JobDetail() {
	const { jobId } = routeApi.useParams();
	const numericJobId = Number(jobId);
	const { data, isPending, error } = useFetchJob(numericJobId);

	// build_index jobs reference an index but not its reference, so the
	// reference id is resolved from the index alongside the job — keeping both
	// fetches under the same loading gate. Job args are a string map, so the
	// index id is converted rather than asserted.
	const indexId =
		data?.workflow === "build_index" ? Number(data.args.index_id) : undefined;
	const { data: index, isPending: isIndexPending } = useFetchIndex(indexId);

	if (!Number.isInteger(numericJobId)) {
		return <NotFound />;
	}

	if (error) {
		if (getErrorStatus(error) === 404) {
			return <NotFound />;
		}
		throw error;
	}

	if (isPending || (indexId !== undefined && isIndexPending)) {
		return <LoadingPlaceholder />;
	}

	const color = getAlertColor(data.state);
	const workflow = getWorkflowDisplayName(data.workflow);
	const args = index
		? { ...data.args, ref_id: String(index.reference.id) }
		: data.args;

	return (
		<ContainerNarrow className="pb-8">
			<ViewHeader title={workflow}>
				<ViewHeaderTitle>{workflow}</ViewHeaderTitle>
				<ViewHeaderAttribution time={data.createdAt} user={data.user.handle} />
			</ViewHeader>
			<JobArgs workflow={data.workflow} args={args} />
			{data.state === "pending" ? (
				<PendingJobAlert createdAt={data.createdAt} />
			) : (
				<Alert color={color}>
					Job {data.state}
					{data.finishedAt && (
						<>
							&nbsp;
							<RelativeTime time={data.finishedAt} />
						</>
					)}
				</Alert>
			)}
			<JobSteps state={data.state} steps={data.steps} />
		</ContainerNarrow>
	);
}
