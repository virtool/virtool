import { cn } from "@app/cn";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
} from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";

const chevrons = {
	up: ChevronUp,
	down: ChevronDown,
	left: ChevronLeft,
	right: ChevronRight,
};

function CalendarChevron({
	className,
	orientation = "right",
}: {
	className?: string;
	orientation?: "up" | "down" | "left" | "right";
}) {
	const Icon = chevrons[orientation];

	return <Icon className={className} size={16} />;
}

const navButtonClassName = cn(
	"cursor-pointer inline-flex h-7 items-center justify-center rounded-md text-gray-500 w-7",
	"hover:bg-gray-100 hover:text-gray-900",
	"outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
	"disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
);

const dayButtonClassName = cn(
	"cursor-pointer flex font-normal h-8 items-center justify-center rounded-md text-sm w-8",
	"hover:bg-gray-100",
	"outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:z-10",
);

/**
 * A month calendar for picking a day or a range of days.
 *
 * The day picker's own stylesheet is never loaded — every element is classed
 * from here, so the calendar matches the rest of the interface rather than the
 * library's default theme. This component pulls `react-day-picker` and its
 * `date-fns` dependency into its consumer's bundle, so lazy-load consumers that
 * do not need a calendar on initial render. Use `@app/date`, not `date-fns`, for
 * other application date helpers.
 */
export default function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: ComponentProps<typeof DayPicker>) {
	return (
		<DayPicker
			className={cn("p-3", className)}
			classNames={{
				root: "w-fit",
				months: "flex flex-col gap-4 relative sm:flex-row",
				month: "flex flex-col gap-3",
				month_caption: "flex h-7 items-center justify-center",
				caption_label: "flex font-medium gap-1 items-center text-sm",
				nav: "absolute flex inset-x-0 items-center justify-between top-0 z-10",
				button_previous: navButtonClassName,
				button_next: navButtonClassName,
				dropdowns: "flex gap-1.5 items-center",
				dropdown_root: "relative",
				dropdown: "absolute cursor-pointer inset-0 opacity-0 w-full",
				month_grid: "border-collapse",
				weekdays: "flex",
				weekday: "font-normal text-gray-500 text-xs w-8",
				week: "flex mt-1",
				day: "h-8 p-0 relative text-center w-8",
				day_button: dayButtonClassName,
				// Modifier classes apply to the cell, so child selectors style its button.
				// Keep `today` and `selected` disjoint to avoid competing text styles.
				selected:
					"[&>button]:bg-gray-700 [&>button]:text-white [&>button]:hover:bg-gray-700",
				// The band is painted on the cell, so it runs unbroken between
				// adjacent days; the week's own edges round it where a range wraps.
				range_start: "bg-gray-100 rounded-l-md",
				range_end: "bg-gray-100 rounded-r-md",
				range_middle: cn(
					"bg-gray-100 first:rounded-l-md last:rounded-r-md",
					"[&>button]:bg-transparent! [&>button]:text-gray-900!",
					"[&>button]:hover:bg-gray-200!",
				),
				today:
					"[&:not([data-selected])>button]:font-semibold [&:not([data-selected])>button]:ring-1 [&:not([data-selected])>button]:ring-gray-400",
				outside: "[&:not([data-selected])>button]:text-gray-400",
				disabled:
					"[&>button]:cursor-default [&>button]:opacity-40 [&>button]:hover:bg-transparent",
				hidden: "invisible",
				...classNames,
			}}
			components={{ Chevron: CalendarChevron }}
			showOutsideDays={showOutsideDays}
			{...props}
		/>
	);
}
