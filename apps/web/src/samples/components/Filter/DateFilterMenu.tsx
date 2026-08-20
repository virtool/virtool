import { cn } from "@app/cn";
import { useToday } from "@app/hooks";
import Calendar from "@base/Calendar";
import PopoverContent from "@base/PopoverContent";
import ToggleGroup from "@base/ToggleGroup";
import ToggleGroupItem from "@base/ToggleGroupItem";
import {
	type DateFilter,
	type DateFilterMode,
	dateFilterModes,
	getDateFilterLabel,
	getDateFilterMode,
	getDateFilterModeName,
	getMonthFilter,
	getMonthNames,
	getRangeFilter,
	getYearFilter,
	parseCalendarDate,
} from "@samples/dateFilter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

/** How many years one page of the year grid shows. */
const YEARS_PER_PAGE = 12;

const cellClassName = cn(
	"cursor-pointer flex h-9 items-center justify-center rounded-md text-sm",
	"hover:bg-gray-100",
	"outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
	"aria-pressed:bg-gray-700 aria-pressed:text-white aria-pressed:hover:bg-gray-700",
	"disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
);

const stepClassName = cn(
	"cursor-pointer inline-flex h-7 items-center justify-center rounded-md text-gray-500 w-7",
	"hover:bg-gray-100 hover:text-gray-900",
	"outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
	"disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
);

type StepHeaderProps = {
	isNextDisabled: boolean;
	label: string;
	nextLabel: string;
	onNext: () => void;
	onPrevious: () => void;
	previousLabel: string;
};

function StepHeader({
	isNextDisabled,
	label,
	nextLabel,
	onNext,
	onPrevious,
	previousLabel,
}: StepHeaderProps) {
	return (
		<div className="flex h-7 items-center justify-between">
			<button
				aria-label={previousLabel}
				className={stepClassName}
				onClick={onPrevious}
				type="button"
			>
				<ChevronLeft size={16} />
			</button>
			<span className="font-medium text-sm">{label}</span>
			<button
				aria-label={nextLabel}
				className={stepClassName}
				disabled={isNextDisabled}
				onClick={onNext}
				type="button"
			>
				<ChevronRight size={16} />
			</button>
		</div>
	);
}

type DateFilterMenuProps = {
	/** Applies a filter, or clears it when nothing is selected. */
	onChange: (filter: DateFilter | undefined) => void;

	/** The filter currently narrowing the list, if any. */
	value?: DateFilter;
};

/**
 * A popover for narrowing the samples list to a month, a year, or a range of
 * days picked off a calendar.
 *
 * Each mode produces the same pair of bounds, so switching between them only
 * changes how the days are chosen. The mode the popover opens on is recovered
 * from the active filter's bounds rather than remembered.
 */
export default function DateFilterMenu({
	onChange,
	value,
}: DateFilterMenuProps) {
	const today = useToday();
	const todayDate = parseCalendarDate(today) ?? new Date(0);
	const currentYear = todayDate.getFullYear();

	const selectedStart = value ? parseCalendarDate(value.after) : undefined;
	const selectedMode = value ? getDateFilterMode(value) : undefined;

	const [mode, setMode] = useState<DateFilterMode>(selectedMode ?? "month");
	const [year, setYear] = useState(selectedStart?.getFullYear() ?? currentYear);
	const [yearPageEnd, setYearPageEnd] = useState(
		Math.min(
			currentYear,
			(selectedStart?.getFullYear() ?? currentYear) + YEARS_PER_PAGE - 1,
		),
	);

	// Only half a range has been picked until both ends are in, so the picked
	// days are held here and only published once the second one lands.
	const [range, setRange] = useState<DateRange | undefined>(
		value && selectedStart
			? { from: selectedStart, to: parseCalendarDate(value.before) }
			: undefined,
	);

	// Switching to the calendar carries the active filter onto it, so a month or
	// year already chosen can be widened by a day rather than picked again.
	function handleChangeMode(next: DateFilterMode) {
		setMode(next);

		if (next === "range" && value) {
			setRange({
				from: parseCalendarDate(value.after),
				to: parseCalendarDate(value.before),
			});
		}
	}

	function handleSelectRange(next: DateRange | undefined) {
		setRange(next);

		if (next?.from && next.to) {
			onChange(getRangeFilter(next.from, next.to));
		}
	}

	const years = Array.from(
		{ length: YEARS_PER_PAGE },
		(_, index) => yearPageEnd - YEARS_PER_PAGE + 1 + index,
	);

	return (
		<PopoverContent className="w-auto p-3">
			<ToggleGroup
				aria-label="Date filter mode"
				className="grid w-full grid-cols-3"
				onValueChange={(next) => handleChangeMode(next as DateFilterMode)}
				value={mode}
			>
				{dateFilterModes.map((item) => (
					<ToggleGroupItem
						className="min-h-8 justify-center px-3 text-sm"
						key={item}
						value={item}
					>
						{getDateFilterModeName(item)}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<div className="mt-3">
				{mode === "month" && (
					<div className="w-64">
						<StepHeader
							isNextDisabled={year >= currentYear}
							label={String(year)}
							nextLabel="Next year"
							onNext={() => setYear(year + 1)}
							onPrevious={() => setYear(year - 1)}
							previousLabel="Previous year"
						/>
						<div className="mt-2 grid grid-cols-3 gap-1">
							{getMonthNames().map((name, index) => {
								const filter = getMonthFilter(year, index);

								return (
									<button
										aria-label={`${name} ${year}`}
										aria-pressed={
											selectedMode === "month" && value?.after === filter.after
										}
										className={cellClassName}
										disabled={
											year === currentYear && index > todayDate.getMonth()
										}
										key={name}
										onClick={() => onChange(filter)}
										type="button"
									>
										{name.slice(0, 3)}
									</button>
								);
							})}
						</div>
					</div>
				)}
				{mode === "year" && (
					<div className="w-64">
						<StepHeader
							isNextDisabled={yearPageEnd >= currentYear}
							label={`${years[0]} – ${yearPageEnd}`}
							nextLabel="Next years"
							onNext={() =>
								setYearPageEnd(
									Math.min(currentYear, yearPageEnd + YEARS_PER_PAGE),
								)
							}
							onPrevious={() => setYearPageEnd(yearPageEnd - YEARS_PER_PAGE)}
							previousLabel="Previous years"
						/>
						<div className="mt-2 grid grid-cols-3 gap-1">
							{years.map((item) => {
								const filter = getYearFilter(item);

								return (
									<button
										aria-pressed={
											selectedMode === "year" && value?.after === filter.after
										}
										className={cellClassName}
										disabled={item > currentYear}
										key={item}
										onClick={() => onChange(filter)}
										type="button"
									>
										{item}
									</button>
								);
							})}
						</div>
					</div>
				)}
				{mode === "range" && (
					<Calendar
						className="p-0"
						defaultMonth={range?.from ?? todayDate}
						disabled={{ after: todayDate }}
						mode="range"
						numberOfMonths={2}
						onSelect={handleSelectRange}
						selected={range}
						today={todayDate}
					/>
				)}
			</div>
			<div className="mt-3 flex items-center justify-between border-gray-200 border-t pt-2">
				<span className="text-gray-500">
					{value ? getDateFilterLabel(value) : "No date filter"}
				</span>
				<button
					className="cursor-pointer rounded-sm px-2 py-1 text-blue-600 hover:bg-blue-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
					disabled={!value}
					onClick={() => {
						setRange(undefined);
						onChange(undefined);
					}}
					type="button"
				>
					Clear
				</button>
			</div>
		</PopoverContent>
	);
}
