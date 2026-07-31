import { SelectBox, SelectBoxItem } from "@base/SelectBox";
import type { AnalysisWorkflow } from "@virtool/contracts";
import type { workflow } from "./workflows";

type WorkflowSelectorProps = {
	/** The workflows the user can choose between */
	workflows: workflow[];

	/** The id of the currently selected workflow */
	selected: AnalysisWorkflow;

	/** Called with the id of the newly selected workflow */
	onChange: (value: AnalysisWorkflow) => void;
};

/**
 * A boxed picker for choosing which analysis workflow to run.
 */
export default function WorkflowSelector({
	workflows,
	selected,
	onChange,
}: WorkflowSelectorProps) {
	return (
		<div className="mb-6">
			<SelectBox
				className="grid-cols-2"
				label="Workflow"
				// Radix reports the value of the item that was picked, and every
				// item rendered below is one of the given workflows' ids.
				onValueChange={(value) => onChange(value as AnalysisWorkflow)}
				value={selected}
			>
				{workflows.map(({ description, id, name }) => (
					<SelectBoxItem key={id} value={id}>
						<div>{name}</div>
						<span>{description}</span>
					</SelectBoxItem>
				))}
			</SelectBox>
		</div>
	);
}
