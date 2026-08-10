import { cn } from "@app/cn";
import { useFuse } from "@app/fuse";
import Circle from "@base/Circle";
import Link from "@base/Link";
import MultiSelectComboBox from "@base/MultiSelectComboBox";
import type { Label } from "@virtool/contracts";
import { intersectionWith } from "es-toolkit";
import SampleLabel from "../Label/SampleLabel";

type LabelSelectorProps = {
	/** Overrides the spacing around the combobox */
	className?: string;

	/** Suppresses the "no labels yet" hint, which would repeat in a list of rows */
	hideEmptyHint?: boolean;

	/** Hides the label visually, keeping it for assistive technology */
	hideLabel?: boolean;

	/** The combobox's accessible name, which must be unique on the page */
	label?: string;

	/** All labels available for selection */
	labels: Label[];

	/** The ids of the currently selected labels */
	selected: number[];

	/** Called with the next selection when a label is added or removed */
	onChange: (selected: number[]) => void;
};

/**
 * A combobox for selecting the labels to apply to a new sample.
 */
export default function LabelSelector({
	className,
	hideEmptyHint = false,
	hideLabel = false,
	label = "Labels",
	labels,
	selected,
	onChange,
}: LabelSelectorProps) {
	const [results, term, setTerm] = useFuse<Label>(labels, ["name"]);

	const selectedLabels = intersectionWith(
		labels,
		selected,
		(candidate, id) => candidate.id === id,
	);

	function handleChange(next: Label[]) {
		onChange(next.map((candidate) => candidate.id));
	}

	return (
		<div className={cn("mb-6", className)}>
			<MultiSelectComboBox<Label>
				label={label}
				hideLabel={hideLabel}
				items={results}
				selectedItems={selectedLabels}
				onChange={handleChange}
				term={term}
				onTermChange={setTerm}
				itemToKey={(candidate) => String(candidate.id)}
				itemToString={(candidate) => candidate.name}
				placeholder="Select labels"
				renderOption={(candidate) => (
					<SampleLabel
						name={candidate.name}
						color={candidate.color}
						size="sm"
					/>
				)}
				renderChip={(candidate) => (
					<>
						<Circle
							style={{
								color: candidate.color.startsWith("#")
									? candidate.color
									: `#${candidate.color}`,
							}}
						/>
						{candidate.name}
					</>
				)}
			/>
			{!labels.length && !hideEmptyHint && (
				<div className="flex mt-2 text-gray-600 [&_a]:ml-1 [&_a]:text-sm [&_a]:font-medium">
					No labels found. <Link to="/samples/labels">Create one</Link>.
				</div>
			)}
		</div>
	);
}
