import { ToggleGroup, ToggleGroupItem } from "@base/Toggle";

/** Which set a "recently" dashboard card lists: what the user viewed or created. */
export type RecentMode = "viewed" | "created";

type RecentModeToggleProps = {
	/** Names the control for assistive technology, e.g. "Which samples to show". */
	"aria-label": string;

	/** The set currently shown. */
	mode: RecentMode;

	/** Called with the set to switch to. */
	onChange: (mode: RecentMode) => void;
};

// Smaller than a default button so the toggle sits inside a card header without
// crowding the heading beside it.
const itemClassName = "min-h-8 px-3 text-sm";

/**
 * The Viewed/Created switch shown in a "recently" card's header.
 *
 * `ToggleGroup` drops a click that would clear the selection, so exactly one of
 * the two is always active.
 */
export default function RecentModeToggle({
	"aria-label": ariaLabel,
	mode,
	onChange,
}: RecentModeToggleProps) {
	return (
		<ToggleGroup
			aria-label={ariaLabel}
			onValueChange={(value) => onChange(value as RecentMode)}
			value={mode}
		>
			<ToggleGroupItem className={itemClassName} value="viewed">
				Viewed
			</ToggleGroupItem>
			<ToggleGroupItem className={itemClassName} value="created">
				Created
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
