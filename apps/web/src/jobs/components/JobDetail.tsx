import { getErrorStatus } from "@app/queryErrors";
import { getWorkflowDisplayName } from "@app/utils";
import ContainerNarrow from "@base/ContainerNarrow";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderAttribution from "@base/ViewHeaderAttribution";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { useFetchIndex } from "@indexes/queries";
import { getRouteApi } from "@tanstack/react-router";
import { useFetchJob } from "../queries";
import JobArgs from "./JobArgs";
import JobSteps from "./JobSteps";

const routeApi = getRouteApi("/_authenticated/jobs/$jobId");

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
			<JobSteps
				finishedAt={data.finishedAt}
				state={data.state}
				steps={data.steps}
			/>
		</ContainerNarrow>
	);
}
