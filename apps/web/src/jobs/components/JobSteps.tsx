import { useNow } from "@app/hooks";
import BoxGroup from "@base/BoxGroup";
import type { JobState, JobStep } from "@virtool/contracts";
import JobStepItem from "./JobStep";

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

	if (claimedSteps.length === 0) {
		return null;
	}

	return (
		<BoxGroup className="overflow-hidden">
			<table className="table-fixed w-full">
				<thead>
					<tr className="bg-gray-50 border-b border-gray-300 text-gray-600 text-sm">
						<th className="px-4 py-3 w-12">
							<span className="sr-only">Status</span>
						</th>
						<th className="font-medium px-4 py-3 text-left">Step</th>
						<th className="font-medium px-4 py-3 text-left w-1/4">Started</th>
						<th className="font-medium px-4 py-3 text-right w-1/4">Elapsed</th>
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
		</BoxGroup>
	);
}
