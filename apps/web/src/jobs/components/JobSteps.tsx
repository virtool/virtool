import { useNow } from "@app/hooks";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import RelativeTime from "@base/RelativeTime";
import type { JobState, JobStep } from "@virtool/contracts";
import JobStateIcon from "./JobStateIcon";
import JobStepItem from "./JobStep";

const statusTitles: Record<JobState, string> = {
	cancelled: "Cancelled",
	failed: "Failed",
	pending: "Waiting for a runner",
	running: "Waiting for the first step",
	succeeded: "Succeeded",
};

type JobStatusProps = {
	finishedAt: Date | null;
	state: JobState;
};

/**
 * The job's own state, shown when no step has started and the step rows can
 * therefore say nothing about it.
 */
function JobStatus({ finishedAt, state }: JobStatusProps) {
	return (
		<BoxGroupSection className="py-6">
			<div className="flex gap-2 items-center">
				<JobStateIcon state={state} />
				<h2 className="font-medium text-base">{statusTitles[state]}</h2>
			</div>
			<p className="mt-1 mb-0 text-gray-600">
				{state === "pending" ? (
					"This job is queued. Its steps will appear when a runner claims it."
				) : state === "running" ? (
					"A runner has claimed this job. Its steps will appear as they start."
				) : finishedAt ? (
					<>
						This job finished <RelativeTime time={finishedAt} />.
					</>
				) : null}
			</p>
		</BoxGroupSection>
	);
}

type JobStepsProps = {
	finishedAt: Date | null;
	state: JobState;
	steps: JobStep[] | null;
};

export default function JobSteps({ finishedAt, state, steps }: JobStepsProps) {
	const now = useNow();
	const claimedSteps = steps ?? [];
	const lastStartedIndex = claimedSteps.findLastIndex(
		(step) => step.startedAt !== null,
	);

	return (
		<BoxGroup className="overflow-hidden">
			{lastStartedIndex === -1 && (
				<JobStatus finishedAt={finishedAt} state={state} />
			)}
			{claimedSteps.length > 0 && (
				<table className="table-fixed w-full">
					<thead>
						<tr className="bg-gray-50 border-b border-gray-300 text-gray-600 text-sm">
							<th className="px-4 py-3 w-12">
								<span className="sr-only">Status</span>
							</th>
							<th className="font-medium px-4 py-3 text-left">Step</th>
							<th className="font-medium px-4 py-3 text-left w-1/5">Started</th>
							<th className="font-medium px-4 py-3 text-left w-1/6">Elapsed</th>
						</tr>
					</thead>
					<tbody>
						{claimedSteps.map((step, index) => {
							const nextStartedAt = claimedSteps[index + 1]?.startedAt;
							const endedAt = step.startedAt
								? ((nextStartedAt ?? finishedAt)?.getTime() ?? now)
								: null;
							const stepState =
								step.startedAt === null
									? "pending"
									: index === lastStartedIndex
										? state
										: "succeeded";

							return (
								<JobStepItem
									endedAt={endedAt}
									key={step.id}
									step={step}
									state={stepState}
								/>
							);
						})}
					</tbody>
				</table>
			)}
		</BoxGroup>
	);
}
