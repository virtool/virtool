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

// The day picker joins its modifier class names onto the cell rather than the
// button inside it, so each state below reaches the button through a child
// selector. A day both `selected` and `today` would otherwise get two competing
// text colours, resolved by stylesheet order rather than intent — hence the
// `:not([data-selected])` guards, which make the two disjoint.
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
 * library's default theme.
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
				selected:
					"[&>button]:bg-blue-600 [&>button]:text-white [&>button]:hover:bg-blue-600",
				// The band is painted on the cell, so it runs unbroken between
				// adjacent days; the week's own edges round it where a range wraps.
				range_start: "bg-blue-50 rounded-l-md",
				range_end: "bg-blue-50 rounded-r-md",
				range_middle: cn(
					"bg-blue-50 first:rounded-l-md last:rounded-r-md",
					"[&>button]:bg-transparent! [&>button]:text-blue-900!",
					"[&>button]:hover:bg-blue-100!",
				),
				today:
					"[&:not([data-selected])>button]:font-semibold [&:not([data-selected])>button]:text-blue-600",
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
