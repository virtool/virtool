/**
 * The cache key derivation, ported from `canonicalize_params` / `derive_key` in
 * Python's `virtool/caches/utils.py`.
 *
 * Python is:
 *
 * ```python
 * sha256(json.dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
 * ```
 *
 * A TypeScript nuvs must derive the same key as a Python nuvs for the shared
 * namespaces, or the two never reuse each other's work during cutover. A
 * divergence here does not fail — it silently misses every cache and writes a
 * second copy under a key nothing else will ever ask for.
 *
 * `JSON.stringify` does not reproduce `json.dumps`, so this serialises by hand.
 * Three divergences make that necessary:
 *
 * 1. **`ensure_ascii=True`.** Python's escape set is `[^\ -~]` — everything
 *    outside `0x20`–`0x7E`, so `0x7F` (DEL) is escaped too, not just what is
 *    above it. `JSON.stringify` emits both literally.
 * 2. **Float formatting.** `json.dumps(1.0)` is `"1.0"`; `JSON.stringify(1.0)`
 *    is `"1"`. Python distinguishes `int` from `float` and JavaScript has one
 *    number type, so the distinction has to be carried explicitly — see
 *    {@link float}.
 * 3. **Key ordering.** `sort_keys` sorts by code point and `Array.sort` sorts by
 *    UTF-16 code unit. Non-ASCII keys are rejected rather than sorted, which
 *    makes the two orders identical over what remains.
 */

import { createHash } from "node:crypto";
import { CacheParamError } from "../errors";

const CACHE_FLOAT = Symbol("cacheFloat");

/**
 * A number that must serialise the way Python serialises a `float`.
 *
 * Build one with {@link float}.
 */
export type CacheFloat = {
	readonly [CACHE_FLOAT]: true;
	readonly value: number;
};

/** A value admissible in a set of cache params. */
export type CacheParamValue =
	| string
	| number
	| boolean
	| null
	| CacheFloat
	| readonly CacheParamValue[]
	| { readonly [key: string]: CacheParamValue };

/** The params a cache key is derived from. */
export type CacheParams = { readonly [key: string]: CacheParamValue };

/**
 * Mark a number as a Python `float` rather than an `int`.
 *
 * An unmarked number serialises as an integer, and an integral one that Python
 * holds as a float would then derive a different key: nuvs' `max_error_rate`
 * and `max_indel_rate` are Python floats defaulting to `0.1` and `0.03`, which
 * happen to round-trip identically — so the bug stays invisible until someone
 * configures `1.0`.
 */
export function float(value: number): CacheFloat {
	return { [CACHE_FLOAT]: true, value };
}

function isCacheFloat(value: object): value is CacheFloat {
	return CACHE_FLOAT in value;
}

// Outside this band Python and JavaScript disagree on whether to use
// exponential notation, and on how to spell the exponent when they agree —
// Python's `repr(1e16)` is `1e+16` where JavaScript's is `10000000000000000`,
// and `repr(0.00001)` is `1e-05` where JavaScript's is `0.00001`. Rejecting is
// the honest option: no cache param in either workflow is near these bounds,
// and a silent divergence costs a permanently unshared namespace.
const MIN_EXACT_MAGNITUDE = 1e-4;
const MAX_EXACT_MAGNITUDE = 1e16;

function formatFloat(value: number): string {
	if (!Number.isFinite(value)) {
		throw new CacheParamError(
			`cannot derive a cache key from the non-finite number ${value}`,
		);
	}

	const magnitude = Math.abs(value);

	if (
		magnitude !== 0 &&
		(magnitude < MIN_EXACT_MAGNITUDE || magnitude >= MAX_EXACT_MAGNITUDE)
	) {
		throw new CacheParamError(
			`cannot derive a cache key from ${value}: Python and JavaScript format numbers of this magnitude differently`,
		);
	}

	// Negative zero survives arithmetic in JavaScript but `String(-0)` is `"0"`,
	// where Python's `repr` is `"-0.0"`. Checked before the integral branch,
	// which would otherwise drop the sign and derive a different key.
	if (Object.is(value, -0)) {
		return "-0.0";
	}

	// `String` and Python's `repr` are both shortest-round-trip inside the band,
	// so they agree on everything but the trailing `.0` Python adds to an
	// integral float.
	return Number.isInteger(value) ? `${value}.0` : String(value);
}

function formatInteger(value: number): string {
	if (!Number.isSafeInteger(value)) {
		throw new CacheParamError(
			`cannot derive a cache key from ${value}: an unmarked number must be a safe integer, and a fractional one must be wrapped in float()`,
		);
	}

	return String(value);
}

function serializeString(value: string): string {
	let out = '"';

	for (let index = 0; index < value.length; index++) {
		const character = value[index];
		const code = value.charCodeAt(index);

		if (character === '"') {
			out += '\\"';
		} else if (character === "\\") {
			out += "\\\\";
		} else if (character === "\n") {
			out += "\\n";
		} else if (character === "\r") {
			out += "\\r";
		} else if (character === "\t") {
			out += "\\t";
		} else if (character === "\b") {
			out += "\\b";
		} else if (character === "\f") {
			out += "\\f";
		} else if (code < 0x20 || code > 0x7e) {
			// Iterating by code unit rather than code point is deliberate: Python
			// escapes an astral character as its two surrogates, which is what
			// `charCodeAt` already yields.
			out += `\\u${code.toString(16).padStart(4, "0")}`;
		} else {
			out += character;
		}
	}

	return `${out}"`;
}

function serializeKey(key: string): string {
	for (let index = 0; index < key.length; index++) {
		if (key.charCodeAt(index) > 0x7e) {
			throw new CacheParamError(
				`cannot derive a cache key from the non-ASCII param key ${JSON.stringify(key)}: Python sorts keys by code point and JavaScript sorts by UTF-16 code unit`,
			);
		}
	}

	return serializeString(key);
}

function serialize(value: CacheParamValue): string {
	if (value === null) {
		return "null";
	}

	if (typeof value === "string") {
		return serializeString(value);
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "number") {
		return formatInteger(value);
	}

	if (typeof value !== "object") {
		throw new CacheParamError(
			`cannot derive a cache key from a value of type ${typeof value}`,
		);
	}

	if (isCacheFloat(value)) {
		return formatFloat(value.value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(serialize).join(",")}]`;
	}

	const record = value as { readonly [key: string]: CacheParamValue };

	return `{${Object.keys(record)
		.sort()
		.map((key) => `${serializeKey(key)}:${serialize(record[key])}`)
		.join(",")}}`;
}

/**
 * Serialise `params` to the exact string Python's `canonicalize_params`
 * produces.
 *
 * @throws {CacheParamError} on a non-ASCII key, an unmarked fractional number,
 *   or a number Python and JavaScript would format differently.
 */
export function canonicalizeCacheParams(params: CacheParams): string {
	return serialize(params);
}

/** The SHA-256 hex digest of {@link canonicalizeCacheParams}' output. */
export function deriveCacheKey(params: CacheParams): string {
	return createHash("sha256")
		.update(canonicalizeCacheParams(params), "utf8")
		.digest("hex");
}
