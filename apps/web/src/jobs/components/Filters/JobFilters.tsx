import type { JobCounts, JobState } from "@virtool/contracts";
import StateFilter from "./StateFilter";

type StateFilterProps = {
	counts: JobCounts;
	setStates: (states: JobState[]) => void;
	states: JobState[];
};

/**
 * Displays the state filter options for jobs
 */
export function JobFilters({ counts, setStates, states }: StateFilterProps) {
	return (
		<div>
			<StateFilter counts={counts} setStates={setStates} states={states} />
		</div>
	);
}
