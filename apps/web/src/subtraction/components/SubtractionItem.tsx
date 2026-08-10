import BoxGroupSection from "@base/BoxGroupSection";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import { useFetchJob } from "@jobs/queries";
import { getCreateJobStatus } from "@subtraction/utils";
import {
	isJobStateUnsuccessful,
	type SubtractionMinimal,
} from "@virtool/contracts";
import { SubtractionAttribution } from "./Attribution";

/**
 * A condensed subtraction item for use in a list of subtractions
 */
export function SubtractionItem({
	createdAt,
	id,
	job,
	name,
	ready,
	user,
}: SubtractionMinimal) {
	// The seed needs a user, and a job whose creator was removed has none — fall
	// back to fetching rather than priming the cache with a half-built job.
	const { data: fetchedJob } = useFetchJob(
		job?.id ?? Number.NaN,
		job?.user ? { ...job, user: job.user } : undefined,
	);

	const status = getCreateJobStatus(job, fetchedJob);

	return (
		<BoxGroupSection as="li" className="grid grid-cols-5 items-center">
			<Link
				className="col-span-2 text-lg font-medium"
				to="/subtractions/$subtractionId"
				params={{ subtractionId: String(id) }}
			>
				{name}
			</Link>
			<div className="col-span-2 flex justify-start">
				<SubtractionAttribution handle={user?.handle ?? ""} time={createdAt} />
			</div>
			{!ready && status && (
				<span className="flex items-center justify-end gap-1 font-medium">
					{isJobStateUnsuccessful(status.state) && (
						<span className="capitalize">{status.state}</span>
					)}
					<ProgressCircle progress={status.progress} state={status.state} />
				</span>
			)}
		</BoxGroupSection>
	);
}
