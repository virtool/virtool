/**
 * Number formatting built on the native `Intl.NumberFormat` API.
 *
 * Kept apart from `@app/utils` so these formatters — and the `Intl` formatter
 * instances they cache at module scope — stay out of bundles that only want an
 * unrelated general utility.
 */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const byteFormatter = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false,
});

const thousandFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 0,
});

const coefficientFormatter = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 3,
	maximumFractionDigits: 3,
	useGrouping: false,
});

const gcContentFormatter = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

/**
 * Convert an integer in bytes to a nicely formatted string (eg. 10.2 GB).
 */
export function byteSize(
	bytes: number | null,
	spaceSeparated: boolean = false,
): string {
	if (!bytes) {
		return "0.0B";
	}

	const exponent = Math.min(
		Math.floor(Math.log10(Math.abs(bytes)) / 3),
		BYTE_UNITS.length - 1,
	);
	const value = bytes / 1000 ** exponent;
	const separator = spaceSeparated ? " " : "";

	return `${byteFormatter.format(value)}${separator}${BYTE_UNITS[exponent]}`;
}

export function toThousand(num: number): string {
	return thousandFormatter.format(num);
}

/**
 * Format a GC content fraction (0–1) as a percentage (eg. 45.2%).
 */
export function toGcContent(fraction: number): string {
	return gcContentFormatter.format(fraction);
}

/**
 * Prefix a noun with a count, appending "s" unless the count is exactly one
 * (eg. `1 read position`, `3 read positions`). Pass `plural` for irregular
 * nouns.
 */
export function pluralize(
	count: number,
	singular: string,
	plural: string = `${singular}s`,
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Converts a ``number`` to a scientific notation string.
 */
export function toScientificNotation(num: number): string {
	if (num === 0) {
		return "0";
	}

	if (num < 0.01 || num > 1000) {
		const [coefficient, exponent] = num.toExponential().split("e");
		return `${coefficientFormatter.format(Number(coefficient))}E${(exponent ?? "").replace("+", "")}`;
	}

	return decimalFormatter.format(num);
}
