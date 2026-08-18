import BoxGroup from "@base/BoxGroup";
import type { JobState, JobStep } from "@virtool/contracts";
import JobStepItem from "./JobStep";

type JobStepsProps = {
	state: JobState;
	steps: JobStep[] | null;
};

export default function JobSteps({ state, steps }: JobStepsProps) {
	const startedSteps = steps?.filter((step) => step.startedAt !== null) ?? [];

	if (startedSteps.length === 0) {
		return null;
	}

	return (
		<BoxGroup>
			{startedSteps.map((step, index) => (
				<JobStepItem
					key={step.id}
					step={step}
					state={index === startedSteps.length - 1 ? state : "succeeded"}
				/>
			))}
		</BoxGroup>
	);
}
