import { getWorkflowDisplayName } from "@app/utils";
import Attribution from "@base/Attribution";
import BoxGroupSection from "@base/BoxGroupSection";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import JobStateIcon from "@jobs/components/JobStateIcon";
import type { JobState, Workflow } from "@jobs/types";
import type { UserNested } from "@virtool/contracts";
import type { ElementType } from "react";

export type JobItemProps = {
	/** The element or component to render as the root (e.g. `"li"` in a list) */
	as?: ElementType;

	/** The job id */
	id: number;

	/** When the job was created */
	createdAt: Date;

	/** The progress of the job */
	progress: number;

	/** The state of the job */
	state: JobState;

	/** The user who created the job */
	user: UserNested;

	/** The workflow of the job */
	workflow: Workflow;
};

/**
 * A condensed job item for use in a list of jobs
 */
export default function JobItem({
	as,
	id,
	createdAt,
	progress,
	state,
	user,
	workflow,
}: JobItemProps) {
	return (
		<BoxGroupSection as={as} className="grid grid-cols-3 text-lg">
			<Link
				className="col-span-1 font-medium"
				to="/jobs/$jobId"
				params={{ jobId: String(id) }}
			>
				{getWorkflowDisplayName(workflow)}
			</Link>
			<Attribution className="col-span-1" time={createdAt} user={user.handle} />
			<div className="col-span-1 flex font-medium gap-1 items-center justify-end">
				<span className="capitalize">{state}</span>
				{state === "succeeded" ? (
					<JobStateIcon state={state} />
				) : (
					<ProgressCircle state={state} progress={progress} />
				)}
			</div>
		</BoxGroupSection>
	);
}
