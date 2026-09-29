import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@base/Field";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
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
		<FieldSet className="mb-6">
			<FieldLegend variant="label">Workflow</FieldLegend>
			<RadioGroup
				className="grid-cols-2"
				// Radix reports the value of the item that was picked, and every
				// item rendered below is one of the given workflows' ids.
				onValueChange={(value) => onChange(value as AnalysisWorkflow)}
				value={selected}
			>
				{workflows.map(({ description, id, name }) => (
					<FieldLabel key={id} variant="card">
						<Field orientation="horizontal" className="items-start">
							<RadioGroupItem className="mt-0.5" value={id} />
							<FieldContent>
								<FieldTitle>{name}</FieldTitle>
								<FieldDescription>{description}</FieldDescription>
							</FieldContent>
						</Field>
					</FieldLabel>
				))}
			</RadioGroup>
		</FieldSet>
	);
}
