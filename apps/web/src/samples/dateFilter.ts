import { formatDate } from "@app/date";

/**
 * The calendar days a samples list is narrowed to, both bounds inclusive.
 *
 * Every way of choosing a date — a month, a year, a hand-picked range —
 * collapses to this pair, so the URL carries one shape and the server needs no
 * mode of its own. The bounds name days rather than instants; the server
 * resolves them against UTC midnight.
 */
export type DateFilter = {
	/** The first day included, as `yyyy-MM-dd`. */
	after: string;

	/** The last day included, as `yyyy-MM-dd`. */
	before: string;
};

/** The ways the date filter menu offers to choose a range. */
export type DateFilterMode = "month" | "year" | "range";

/** The modes, in the order the menu presents them. */
export const dateFilterModes: DateFilterMode[] = ["month", "year", "range"];

const dateFilterModeNames: Record<DateFilterMode, string> = {
	month: "Month",
	year: "Year",
	range: "Range",
};

export function getDateFilterModeName(mode: DateFilterMode): string {
	return dateFilterModeNames[mode];
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `yyyy-MM-dd` day into a `Date` at local midnight, or `undefined` when
 * it isn't one.
 *
 * The parts are passed to the `Date` constructor rather than the string to it:
 * a bare `yyyy-MM-dd` string parses as UTC, which lands on the previous day for
 * anyone west of Greenwich and would show the wrong day selected.
 */
export function parseCalendarDate(value: string): Date | undefined {
	if (!CALENDAR_DATE_PATTERN.test(value)) {
		return undefined;
	}

	const [year, month, day] = value.split("-").map(Number) as [
		number,
		number,
		number,
	];
	const date = new Date(year, month - 1, day);

	// Rejects a day the month doesn't have, which the constructor would roll
	// forward into the next one.
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return undefined;
	}

	return date;
}

/**
 * Build the filter covering a whole calendar month.
 *
 * @param year - the four-digit year
 * @param month - the month index, where January is `0`
 */
export function getMonthFilter(year: number, month: number): DateFilter {
	return {
		after: formatDate(new Date(year, month, 1)),
		// Day zero of the next month is the last day of this one, so no month
		// length has to be known here.
		before: formatDate(new Date(year, month + 1, 0)),
	};
}

export function getYearFilter(year: number): DateFilter {
	return {
		after: formatDate(new Date(year, 0, 1)),
		before: formatDate(new Date(year, 11, 31)),
	};
}

export function getRangeFilter(from: Date, to: Date): DateFilter {
	const first = formatDate(from);
	const second = formatDate(to);

	return first <= second
		? { after: first, before: second }
		: { after: second, before: first };
}

const monthNames = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function getMonthNames(): string[] {
	return monthNames;
}

/**
 * Get the mode that would have produced a filter: a filter spanning exactly one
 * calendar month or year reads as that month or year, and anything else as a
 * range.
 *
 * The URL carries only the two bounds, so the mode a chip shows and the menu
 * opens on is recovered from them rather than stored.
 */
export function getDateFilterMode(filter: DateFilter): DateFilterMode {
	const after = parseCalendarDate(filter.after);

	if (!after) {
		return "range";
	}

	// Neither a month nor a year can start mid-month, so nothing else has to be
	// compared once the lower bound isn't the first.
	if (after.getDate() !== 1) {
		return "range";
	}

	if (
		filter.before === getYearFilter(after.getFullYear()).before &&
		after.getMonth() === 0
	) {
		return "year";
	}

	if (
		filter.before ===
		getMonthFilter(after.getFullYear(), after.getMonth()).before
	) {
		return "month";
	}

	return "range";
}

export function getDateFilterLabel(filter: DateFilter): string {
	const after = parseCalendarDate(filter.after);

	if (!after) {
		return `${filter.after} – ${filter.before}`;
	}

	switch (getDateFilterMode(filter)) {
		case "year":
			return String(after.getFullYear());
		case "month":
			return `${monthNames[after.getMonth()]} ${after.getFullYear()}`;
		default:
			return `${filter.after} – ${filter.before}`;
	}
}

/**
 * Read a date filter out of a pair of search params, discarding a half-set or
 * malformed one.
 *
 * Either bound alone would filter the list without the chip being able to
 * describe it, so both have to be present and parseable for the filter to
 * count.
 */
export function getDateFilter(
	after: string | undefined,
	before: string | undefined,
): DateFilter | undefined {
	if (!after || !before) {
		return undefined;
	}

	const parsedAfter = parseCalendarDate(after);
	const parsedBefore = parseCalendarDate(before);

	if (!parsedAfter || !parsedBefore || parsedAfter > parsedBefore) {
		return undefined;
	}

	return { after, before };
}
