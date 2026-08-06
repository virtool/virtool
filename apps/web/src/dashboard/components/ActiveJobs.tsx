import { getWorkflowDisplayName } from "@app/utils";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import JobStateIcon from "@jobs/components/JobStateIcon";
import { useSuspenseJobs } from "@jobs/queries";
import type { JobState } from "@virtool/contracts";
import { Cog } from "lucide-react";
import { DASHBOARD_ITEM_COUNT } from "../constants";
import DashboardCard, {
	DashboardCardBoundary,
	DashboardCardEmpty,
} from "./DashboardCard";
import DashboardTable, {
	DashboardTableCell,
	DashboardTableCreatedCell,
	DashboardTableMore,
	DashboardTableRow,
} from "./DashboardTable";

/** Matches the default view of the jobs list. */
const activeStates: JobState[] = ["pending", "running"];

/** The jobs currently pending or running, account-wide. */
export default function ActiveJobs() {
	return (
		<DashboardCard
			action={<Link to="/jobs">View all</Link>}
			title="Active jobs"
		>
			<DashboardCardBoundary noun="jobs">
				<ActiveJobsBody />
			</DashboardCardBoundary>
		</DashboardCard>
	);
}

function ActiveJobsBody() {
	const { data } = useSuspenseJobs(1, DASHBOARD_ITEM_COUNT, activeStates);

	if (data.items.length === 0) {
		return (
			<DashboardCardEmpty
				description="Jobs that are pending or running will appear here."
				icon={Cog}
				title="Nothing running"
			/>
		);
	}

	const remaining = data.foundCount - data.items.length;

	return (
		<DashboardTable labels={["Workflow", "State", "Created"]}>
			{data.items.map((job) => (
				<DashboardTableRow key={job.id}>
					<DashboardTableCell>
						<Link
							className="font-medium truncate"
							params={{ jobId: String(job.id) }}
							to="/jobs/$jobId"
						>
							{getWorkflowDisplayName(job.workflow)}
						</Link>
					</DashboardTableCell>
					<DashboardTableCell>
						{job.state === "succeeded" ? (
							<JobStateIcon state={job.state} />
						) : (
							<ProgressCircle progress={job.progress} state={job.state} />
						)}
						<span className="capitalize truncate">{job.state}</span>
					</DashboardTableCell>
					<DashboardTableCreatedCell time={job.createdAt} />
				</DashboardTableRow>
			))}
			{remaining > 0 && (
				<DashboardTableMore>
					<Link search={{ state: activeStates }} to="/jobs">
						View {remaining} more active {remaining === 1 ? "job" : "jobs"}
					</Link>
				</DashboardTableMore>
			)}
		</DashboardTable>
	);
}
