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
