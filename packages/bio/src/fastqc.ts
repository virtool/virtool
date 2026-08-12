import type { Quality } from "@virtool/contracts";

/**
 * Scratch space for decomposing a double in `roundHalfEven`.
 *
 * Shared rather than allocated per call — a FastQC file rounds several
 * thousand values — and safe to share because `roundHalfEven` is synchronous
 * and never re-enters.
 */
const FLOAT_VIEW = new DataView(new ArrayBuffer(8));

/**
 * Round half-to-even, matching Python's built-in `round`.
 *
 * JavaScript has no equivalent. `Math.round` rounds half away from zero, and
 * scaling by a power of ten first (`Math.round(v * 1000) / 1000`) introduces
 * its own error — it disagrees with Python on values such as `2.675` at two
 * places, where the stored double is fractionally below the decimal midpoint.
 *
 * Python rounds the *exact* binary value of the double, so this decomposes the
 * double into `mantissa * 2 ** exponent` and does the comparison in exact
 * integer arithmetic. FastQC values must round identically to Python's because
 * the result is stored and compared across the two implementations.
 */
export function roundHalfEven(value: number, digits: number): number {
	if (!Number.isFinite(value) || value === 0) {
		return value;
	}

	const negative = value < 0;
	const absolute = Math.abs(value);

	FLOAT_VIEW.setFloat64(0, absolute);
	const high = FLOAT_VIEW.getUint32(0);
	const low = FLOAT_VIEW.getUint32(4);

	const rawExponent = (high >>> 20) & 0x7ff;
	const rawMantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
	const mantissa = rawExponent === 0 ? rawMantissa : rawMantissa | (1n << 52n);
	const exponent = rawExponent === 0 ? -1074 : rawExponent - 1075;

	const scale = 10n ** BigInt(digits);
	let numerator = mantissa * scale;
	let denominator = 1n;

	if (exponent >= 0) {
		numerator <<= BigInt(exponent);
	} else {
		denominator = 1n << BigInt(-exponent);
	}

	let quotient = numerator / denominator;
	const twiceRemainder = (numerator - quotient * denominator) * 2n;

	if (
		twiceRemainder > denominator ||
		(twiceRemainder === denominator && quotient % 2n === 1n)
	) {
		quotient += 1n;
	}

	const rounded = Number(quotient) / Number(scale);

	return negative ? -rounded : rounded;
}

/**
 * Parse one value, treating the literal `NaN` as unparseable.
 *
 * This is a deliberate divergence from Python, where `float("NaN")` succeeds
 * and yields `nan`. See `resolveUnparseableRow` for why.
 */
function parseValue(raw: string): number {
	const text = raw.trim();

	if (text === "") {
		throw new Error(`Could not parse value: ${raw}`);
	}

	const value = Number(text);

	if (Number.isNaN(value)) {
		throw new Error(`Could not parse value: ${raw}`);
	}

	return value;
}

/**
 * Replace a row containing an unparseable value, mirroring Python's
 * `_handle_nan_values`: the first value that does parse replaces *every* value
 * in the row, not just the bad ones.
 *
 * The all-`NaN` case diverges from Python deliberately. FastQC writes `NaN` in
 * "Per base sequence content" when a base position has no A, C, G or T at all —
 * its percentage denominator is the sum of those four counts, and `N` is not
 * counted, so a cycle where every read is `N` divides zero by zero and emits
 * four NaNs. Python intends to map that to zeros, but its own zeros branch is
 * unreachable: `float("NaN")` does not raise, so the row never reaches the
 * fallback and Python emits `nan` instead. That output cannot actually be
 * stored — it is invalid JSON, Postgres JSONB rejects it, and the `Quality`
 * schema in `@virtool/contracts` rejects it too — so there is no byte-identical
 * output to preserve. Zero is also the honest reading: no A, C, G or T was
 * observed at that position.
 */
function resolveUnparseableRow(values: string[]): number[] {
	for (const value of values) {
		const text = value.trim();

		if (text === "") {
			continue;
		}

		const parsed = Number(text);

		if (!Number.isNaN(parsed)) {
			return values.map(() => parsed);
		}
	}

	if (values.every((value) => value.trim() === "NaN")) {
		return values.map(() => 0);
	}

	throw new Error(`Could not parse values: ${values.join(", ")}`);
}

function parseRow(values: string[]): number[] {
	try {
		return values.map(parseValue);
	} catch {
		return resolveUnparseableRow(values);
	}
}

function splitFields(line: string): string[] {
	return line.trim().split(/\s+/);
}

/**
 * Resolve a FastQC base position to the zero-based indices it covers.
 *
 * FastQC bins positions once reads get long, writing `10-14` for a bin. The
 * same row is emitted once per index in the bin.
 */
function parseIndexRange(base: string): { start: number; end: number } {
	const positions = base.split("-").map((part) => Number.parseInt(part, 10));

	// `split` always yields at least one element, so `first` is present whatever
	// `base` held — a non-numeric one parses to NaN, which is what Python's
	// `int()` would have raised on and what every caller's loop bound rejects.
	const first = positions[0] ?? Number.NaN;

	if (positions.length > 1) {
		return { start: first - 1, end: positions[1] ?? Number.NaN };
	}

	return { start: first - 1, end: first };
}

type BasicStatistics = {
	count: number;
	encoding: string;
	gc: number;
	length: number[];
};

function parseBasicStatistics(lines: string[]): BasicStatistics {
	const statistics: BasicStatistics = {
		count: 0,
		encoding: "",
		gc: 0,
		length: [0, 0],
	};

	for (const line of lines) {
		if (line.startsWith("#") || line.trim() === "") {
			continue;
		}

		const parts = line.split("\t");

		// The guard proves `parts[1]`; `noUncheckedIndexedAccess` cannot see it.
		const value = parts[1];

		if (value === undefined) {
			continue;
		}

		if (line.includes("Total Sequences")) {
			statistics.count = Number.parseInt(value, 10);
		} else if (line.includes("Encoding")) {
			statistics.encoding = value;
		} else if (line.includes("Sequence length")) {
			if (value.includes("-")) {
				const range = value.split("-").map((part) => Number.parseInt(part, 10));
				statistics.length = [Math.min(...range), Math.max(...range)];
			} else {
				const length = Number.parseInt(value, 10);
				statistics.length = [length, length];
			}
		} else if (line.includes("%GC")) {
			statistics.gc = Number.parseFloat(value);
		}
	}

	return statistics;
}

function parseBaseQuality(lines: string[]): number[][] {
	const bases: number[][] = [];
	let maxIndex = -1;

	for (const line of lines) {
		if (line.trim() === "" || line.startsWith("#")) {
			continue;
		}

		const parts = splitFields(line);

		if (parts.length < 7) {
			continue;
		}

		const values = parseRow(parts.slice(1)).map((value) =>
			roundHalfEven(value, 3),
		);
		const range = parseIndexRange(parts[0] ?? "");

		for (let index = range.start; index < range.end; index++) {
			bases.push([...values]);

			if (index - maxIndex !== 1) {
				throw new Error("Non-contiguous index");
			}

			maxIndex = index;
		}
	}

	return bases;
}

function parseNucleotideComposition(lines: string[]): number[][] {
	const composition: number[][] = [];
	let maxIndex = -1;

	for (const line of lines) {
		if (line.trim() === "" || line.startsWith("#")) {
			continue;
		}

		const parts = splitFields(line);

		if (parts.length < 5) {
			continue;
		}

		const values = parseRow(parts.slice(1));

		if (values.length !== 4) {
			throw new Error(`Expected 4 composition values, got ${values.length}`);
		}

		// FastQC writes these as %G, %A, %T, %C and they are stored in that order.
		const row = values.map((value) => roundHalfEven(value, 1));
		const range = parseIndexRange(parts[0] ?? "");

		for (let index = range.start; index < range.end; index++) {
			composition.push([...row]);

			if (index - maxIndex !== 1) {
				throw new Error("Non-contiguous index");
			}

			maxIndex = index;
		}
	}

	return composition;
}

/**
 * Count reads per mean quality score, as a fixed 50-element array.
 *
 * The length is Python's, and scores of 50 and above are dropped rather than
 * growing it.
 */
function parseSequenceQuality(lines: string[]): number[] {
	const sequences = new Array<number>(50).fill(0);

	for (const line of lines) {
		if (line.trim() === "" || line.startsWith("#")) {
			continue;
		}

		const parts = splitFields(line);

		if (parts.length < 2) {
			continue;
		}

		const quality = Number.parseInt(parts[0] ?? "", 10);

		// The lower bound has no counterpart in Python, where a negative index
		// would assign from the end of the list and a non-numeric score would
		// raise. Neither occurs in real FastQC output — Phred scores are
		// non-negative — but without the guard a malformed line would write a
		// `-1` or `NaN` property onto the array and quietly change its shape.
		if (quality >= 0 && quality < sequences.length) {
			// Truncation toward zero, not a round — Python does `int(float(...))`.
			sequences[quality] = Math.trunc(Number.parseFloat(parts[1] ?? ""));
		}
	}

	return sequences;
}

/**
 * Parse one FastQC `fastqc_data.txt` into a sample `Quality` object.
 *
 * Pure text in, data out. Locating the file is the workflow runtime's job —
 * this package must not touch the filesystem.
 */
export function parseFastqcData(text: string): Quality {
	const sections: { [name: string]: string[] } = {};
	let current: string | null = null;

	for (const rawLine of text.split("\n")) {
		const line = rawLine.replace(/\s+$/, "");

		if (line.startsWith(">>")) {
			if (line.includes(">>END_MODULE")) {
				current = null;
			} else {
				// The text before the first tab; the pass/fail status is dropped.
				// `split` always yields a first element, so this is never absent.
				current = line.split("\t")[0] ?? "";
				sections[current] = [];
			}
		} else if (current !== null && line !== "") {
			sections[current]?.push(line);
		}
	}

	const basicStatistics = parseBasicStatistics(
		sections[">>Basic Statistics"] ?? [],
	);

	return {
		bases: parseBaseQuality(sections[">>Per base sequence quality"] ?? []),
		composition: parseNucleotideComposition(
			sections[">>Per base sequence content"] ?? [],
		),
		count: basicStatistics.count,
		encoding: basicStatistics.encoding,
		gc: basicStatistics.gc,
		length: basicStatistics.length,
		sequences: parseSequenceQuality(
			sections[">>Per sequence quality scores"] ?? [],
		),
	};
}

function meanRows(
	left: number[][],
	right: number[][],
	digits: number,
): number[][] {
	const rows: number[][] = [];
	// Python zips with `strict=False`, so a length mismatch truncates silently.
	const rowCount = Math.min(left.length, right.length);

	for (let i = 0; i < rowCount; i++) {
		// Both indices are inside a bound taken from the two lengths, so neither
		// fallback below is reachable — they are what `noUncheckedIndexedAccess`
		// asks for in place of a proof it cannot construct.
		const leftRow = left[i] ?? [];
		const rightRow = right[i] ?? [];
		const columnCount = Math.min(leftRow.length, rightRow.length);
		const row: number[] = [];

		for (let j = 0; j < columnCount; j++) {
			row.push(
				roundHalfEven(((leftRow[j] ?? 0) + (rightRow[j] ?? 0)) / 2, digits),
			);
		}

		rows.push(row);
	}

	return rows;
}

/**
 * Average two paired-end `Quality` objects into the composite Python stores.
 */
export function compositeQuality(left: Quality, right: Quality): Quality {
	const sequenceCount = Math.min(left.sequences.length, right.sequences.length);
	const sequences: number[] = [];

	for (let i = 0; i < sequenceCount; i++) {
		sequences.push((left.sequences[i] ?? 0) + (right.sequences[i] ?? 0));
	}

	// min/max over the concatenation of the two pairs, not element-wise.
	const lengths = [...left.length, ...right.length];

	return {
		bases: meanRows(left.bases, right.bases, 3),
		composition: meanRows(left.composition, right.composition, 1),
		count: left.count + right.count,
		encoding: left.encoding,
		gc: (left.gc + right.gc) / 2,
		length: [Math.min(...lengths), Math.max(...lengths)],
		sequences,
	};
}
