import BoxGroup from "@base/BoxGroup";
import type { JobState, JobStep } from "@virtool/contracts";
import JobStepItem from "./JobStep";

type JobStepsProps = {
	state: JobState;
	steps: JobStep[] | null;
};

export default function JobSteps({ state, steps }: JobStepsProps) {
	if (steps === null || steps.length === 0) {
		return null;
	}

	return (
		<BoxGroup>
			{steps.map((step, index) => (
				<JobStepItem
					key={step.id}
					step={step}
					state={index === steps.length - 1 ? state : "succeeded"}
				/>
			))}
		</BoxGroup>
	);
}
