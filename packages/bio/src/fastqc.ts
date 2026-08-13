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
