import BoxGroup from "@base/BoxGroup";
import SideBarSection from "@base/SideBarSection";
import SidebarHeader from "@base/SidebarHeader";
import type { JobCounts, JobState } from "@virtool/contracts";
import { xor } from "es-toolkit";
import { StateButton } from "./StateButton";

type StateFilterProps = {
	counts: JobCounts;
	setStates: (states: JobState[]) => void;
	states: JobState[];
};

/**
 * Displays the state filtering for jobs
 */
export default function StateFilter({
	counts,
	setStates,
	states,
}: StateFilterProps) {
	function handleClick(state: JobState) {
		setStates(xor(states, [state]));
	}

	return (
		<SideBarSection className="items-center m-0 relative z-0">
			<SidebarHeader>State</SidebarHeader>
			<BoxGroup>
				<StateButton
					active={states.includes("pending")}
					count={counts.pending}
					label="pending"
					onClick={() => handleClick("pending")}
				/>
				<StateButton
					active={states.includes("running")}
					count={counts.running}
					label="running"
					onClick={() => handleClick("running")}
				/>
				<StateButton
					active={states.includes("succeeded")}
					count={counts.succeeded}
					label="succeeded"
					onClick={() => handleClick("succeeded")}
				/>
				<StateButton
					active={states.includes("cancelled")}
					count={counts.cancelled}
					label="cancelled"
					onClick={() => handleClick("cancelled")}
				/>
				<StateButton
					active={states.includes("failed")}
					count={counts.failed}
					label="failed"
					onClick={() => handleClick("failed")}
				/>
			</BoxGroup>
		</SideBarSection>
	);
}
