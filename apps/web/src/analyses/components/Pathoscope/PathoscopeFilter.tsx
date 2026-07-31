import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { cn } from "@app/cn";
import Button from "@base/Button";
import Icon from "@base/Icon";
import Popover from "@base/Popover";
import Slider from "@base/Slider";
import Switch from "@base/Switch";
import { Funnel } from "lucide-react";
import { useState } from "react";
import { collapsingLabel } from "./collapsingLabel";

type FilterSwitchProps = {
	checked: boolean;
	id: string;
	label: string;
	onCheckedChange: (checked: boolean) => void;
};

function FilterSwitch({
	checked,
	id,
	label,
	onCheckedChange,
}: FilterSwitchProps) {
	return (
		<div className="flex items-center justify-between gap-4">
			<label className="cursor-pointer text-gray-700 text-sm" htmlFor={id}>
				{label}
			</label>
			<Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />
		</div>
	);
}

type CoverageSliderProps = {
	disabled: boolean;
	onCommit: (value: number) => void;
	value: number;
};

/**
 * The coverage cutoff, moved live and written to the URL only on release.
 *
 * Committing every step would push a router navigation per 0.01 of a drag. Its
 * owner keys this on the committed value, so a cutoff that changes from outside
 * — the back button — replaces the dragged value rather than being shadowed by
 * it.
 */
function CoverageSlider({ disabled, onCommit, value }: CoverageSliderProps) {
	const [draft, setDraft] = useState(value);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-baseline justify-between">
				<span className="text-gray-700 text-sm">
					Hide when coverage less than
				</span>
				<span className="font-semibold tabular-nums text-sm">
					{draft.toFixed(2)}
				</span>
			</div>
			<Slider
				aria-label="Minimum coverage"
				disabled={disabled}
				max={1}
				min={0}
				onValueChange={(next) => setDraft(next[0] ?? draft)}
				onValueCommit={(next) => onCommit(next[0] ?? draft)}
				step={0.01}
				value={[draft]}
			/>
		</div>
	);
}

/** The filters that decide which pathoscope hits and isolates are shown. */
export default function PathoscopeFilter() {
	const { search, setSearch } = useAnalysisSearch();
	const { minCoverage, showLowIsolates, showLowOtus, table } = search;

	// The isolate filter only reaches an expanded hit, so it is not narrowing
	// anything in the table layout.
	const isFiltering = !showLowOtus || (!showLowIsolates && !table);

	return (
		<Popover
			// Right edge flush with the trigger's. `Popover` aligns to that end by
			// default but pulls 20px back off it, tuned for the sample sidebar it was
			// written for.
			align="end"
			alignOffset={0}
			// Matches `DropdownMenuContent`'s offset, so the export menu beside it
			// in the toolbar does not sit at a different distance from its trigger.
			sideOffset={4}
			trigger={
				// Not `aria-pressed`: the trigger already reports open/closed through
				// `aria-expanded`, and a second state on the same control would leave
				// "the popover is open" and "hits are being hidden" indistinguishable.
				// The dot says it visually and the name says it out loud.
				<Button aria-label={isFiltering ? "Filter (on)" : "Filter"}>
					<span className="relative flex">
						<Icon icon={Funnel} />
						{isFiltering && (
							<span
								aria-hidden="true"
								className={cn(
									"absolute",
									"-right-0.5",
									"-top-0.5",
									"size-2",
									"rounded-full",
									"bg-blue-600",
								)}
							/>
						)}
					</span>
					<span className={collapsingLabel}>Filter</span>
				</Button>
			}
		>
			<div className="flex flex-col gap-4 p-4">
				<div className="flex flex-col gap-3">
					<FilterSwitch
						checked={!showLowOtus}
						id="PathoscopeFilterOtus"
						label="Hide low-coverage OTUs"
						onCheckedChange={(checked) => setSearch({ showLowOtus: !checked })}
					/>
					{/* Isolates are only ever shown in an expanded hit, which the table
					    layout has none of — the switch would change nothing on screen. */}
					{!table && (
						<FilterSwitch
							checked={!showLowIsolates}
							id="PathoscopeFilterIsolates"
							label="Hide low-coverage isolates"
							onCheckedChange={(checked) =>
								setSearch({ showLowIsolates: !checked })
							}
						/>
					)}
				</div>
				<hr className="border-gray-200" />
				<CoverageSlider
					disabled={!isFiltering}
					key={minCoverage}
					onCommit={(minCoverage) => setSearch({ minCoverage })}
					value={minCoverage}
				/>
			</div>
		</Popover>
	);
}
