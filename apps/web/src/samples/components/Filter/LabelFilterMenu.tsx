import { FilterMenuCheckboxItem, FilterMenuContent } from "@base/Filter";
import { getHexColor } from "@samples/labels";
import type { Label } from "@virtool/contracts";

type LabelFilterMenuProps = {
	/** All available labels. */
	labels: Label[];

	/** Deselects every label. */
	onClear: () => void;

	/** Toggles a single label. */
	onToggle: (labelId: number) => void;

	/** Selected label IDs. */
	selected: number[];
};

/**
 * A dropdown menu for selecting the labels that samples are filtered by
 */
export default function LabelFilterMenu({
	labels,
	onClear,
	onToggle,
	selected,
}: LabelFilterMenuProps) {
	return (
		<FilterMenuContent onClear={onClear} showClear={selected.length > 0}>
			{labels.length === 0 ? (
				<p className="px-2 py-1.5 text-gray-500 text-sm">
					No labels have been created.
				</p>
			) : (
				labels.map((label) => (
					<FilterMenuCheckboxItem
						checked={selected.includes(label.id)}
						key={label.id}
						onCheckedChange={() => onToggle(label.id)}
					>
						<span
							className="rounded-full shrink-0 size-3"
							style={{ backgroundColor: getHexColor(label.color) }}
						/>
						<span className="flex-grow truncate">{label.name}</span>
					</FilterMenuCheckboxItem>
				))
			)}
		</FilterMenuContent>
	);
}
