/**
 * Date utilities using browser APIs to replace date-fns.
 */

const TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 31536000],
	["month", 2592000],
	["week", 604800],
	["day", 86400],
	["hour", 3600],
	["minute", 60],
	["second", 1],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
	numeric: "always",
	style: "long",
});

/**
 * Format the distance between two dates as a human-readable string.
 *
 * @param date - the date to compare
 * @param baseDate - the base date to compare against (defaults to now)
 * @param options - formatting options
 * @returns a string like "3 days ago" or "in 5 minutes"
 */
export function formatDistanceStrict(
	date: Date,
	baseDate: Date | number = Date.now(),
	options: { addSuffix?: boolean } = {},
): string {
	const { addSuffix = false } = options;
	const baseDateObj =
		typeof baseDate === "number" ? new Date(baseDate) : baseDate;
	const diffInSeconds = Math.round(
		(date.getTime() - baseDateObj.getTime()) / 1000,
	);
	const absoluteDiff = Math.abs(diffInSeconds);

	for (const [unit, secondsInUnit] of TIME_UNITS) {
		if (absoluteDiff >= secondsInUnit || unit === "second") {
			const value = Math.round(absoluteDiff / secondsInUnit);
			const signedValue = diffInSeconds < 0 ? -value : value;

			if (addSuffix) {
				return relativeTimeFormatter.format(signedValue, unit);
			}

			return `${value} ${unit}${value !== 1 ? "s" : ""}`;
		}
	}

	return addSuffix ? "just now" : "0 seconds";
}

/**
 * Format a duration in seconds as a human-readable string.
 *
 * Returns the largest non-zero unit (e.g., "3 hours", "2 days").
 *
 * @param seconds - the duration in seconds
 * @returns a human-readable duration string
 */
export function formatRoundedDuration(seconds: number): string {
	if (seconds < 1) {
		return "less than a second";
	}

	for (const [unit, secondsInUnit] of TIME_UNITS) {
		const value = Math.floor(seconds / secondsInUnit);
		if (value >= 1) {
			return `${value} ${unit}${value !== 1 ? "s" : ""}`;
		}
	}

	return "less than a second";
}

/**
 * Format a duration in seconds as a clock string (HH:MM:SS).
 *
 * Hours are not wrapped at 24: a job that ran for a day and a half reads
 * `36:00:00`, because the figure is an elapsed duration rather than a time of
 * day.
 *
 * @param seconds - the duration in seconds
 * @returns a zero-padded clock string
 */
export function formatElapsed(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));

	return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
}

/**
 * Add seconds to a date.
 *
 * @param date - the base date
 * @param seconds - the number of seconds to add
 * @returns a new Date with the seconds added
 */
export function addSeconds(date: Date, seconds: number): Date {
	return new Date(date.getTime() + seconds * 1000);
}

/**
 * Format a date as a time string (HH:mm:ss).
 *
 * @param date - the date to format
 * @returns a time string in 24-hour format
 */
export function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

/**
 * Format a date as an ISO date string (yyyy-MM-dd).
 *
 * @param date - the date to format
 * @returns a date string in ISO format
 */
export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Format a date as `yyyy-MM-dd HH:mm` in the local time zone.
 *
 * @param date - the date to format
 * @returns a date and 24-hour time string
 */
export function formatDateTime(date: Date): string {
	return `${formatDate(date)} ${formatTime(date).slice(0, 5)}`;
}

const monthDayFormatter = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
});

const monthDayYearFormatter = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** A date described relative to the calendar day it is read on. */
type CalendarTime = {
	/** The name of the day, if the date is today or yesterday. */
	day: "today" | "yesterday" | null;

	/** The date as text, such as "Today at 11:12" or "Sep 26, 2023". */
	text: string;
};

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * Describe a date by the calendar day it falls on, in the local time zone.
 *
 * The detail falls as the date gets older: today and yesterday give the day
 * name and the time, a date earlier in the current year gives the month, day,
 * and time, and a date in an earlier year gives the month, day, and year only.
 * A date after `now`, from a browser clock that lags the server's, reads as
 * today.
 *
 * @param date - the date to describe
 * @param now - the instant to describe it from
 */
export function formatCalendarTime(date: Date, now: number): CalendarTime {
	const today = new Date(now);
	const time = formatTime(date).slice(0, 5);

	if (isSameDay(date, today) || date.getTime() > now) {
		return { day: "today", text: `Today at ${time}` };
	}

	const yesterday = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() - 1,
	);

	if (isSameDay(date, yesterday)) {
		return { day: "yesterday", text: `Yesterday at ${time}` };
	}

	if (date.getFullYear() === today.getFullYear()) {
		return { day: null, text: `${monthDayFormatter.format(date)} at ${time}` };
	}

	return { day: null, text: monthDayYearFormatter.format(date) };
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a string has the `yyyy-MM-dd` shape a calendar date is written in.
 *
 * Shape only: the pattern admits days no month has, so a caller that needs a
 * real day parses it as well.
 */
export function isCalendarDate(value: string): boolean {
	return CALENDAR_DATE_PATTERN.test(value);
}

/**
 * Format a date as `yyyy-MM-dd` in UTC.
 *
 * The counterpart to {@link formatDate}, for the days a date filter names —
 * those resolve against UTC midnight on the server, so the day they belong to
 * has to be read off the same clock.
 */
export function formatUtcDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
