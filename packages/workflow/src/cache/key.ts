/**
 * The cache key derivation: {@link canonicalizeCacheParams} serialises a param
 * set to its canonical string, and {@link deriveCacheKey} hashes that string.
 *
 * The canonical form is JSON with keys sorted by code point, no whitespace
 * between tokens (`,` and `:` separators only), and every character outside
 * `0x20`–`0x7E` escaped as `\uXXXX`. The key is the SHA-256 hex digest of the
 * canonical string's UTF-8 bytes.
 *
 * The format is frozen. Cache blobs already in the bucket are addressed by
 * these keys, and every workflow sharing a namespace has to derive them
 * identically. A divergence here does not fail — it silently misses every
 * cache and writes a second copy under a key nothing else will ever ask for.
 *
 * `JSON.stringify` does not produce this form, so this serialises by hand.
 * Three divergences make that necessary:
 *
 * 1. **ASCII escaping.** The escape set is `[^\ -~]` — everything outside
 *    `0x20`–`0x7E`, so `0x7F` (DEL) is escaped too, not just what is above it.
 *    `JSON.stringify` emits both literally.
 * 2. **Float formatting.** A float serialises as `1.0` where the integer `1`
 *    serialises as `1`, but `JSON.stringify(1.0)` is `"1"`. JavaScript has a
 *    single number type, so the distinction has to be carried explicitly — see
 *    {@link float}.
 * 3. **Key ordering.** The format sorts keys by code point and `Array.sort`
 *    sorts by UTF-16 code unit. Non-ASCII keys are rejected rather than sorted,
 *    which makes the two orders identical over what remains.
 */

import { createHash } from "node:crypto";
import type { JsonObject, JsonValue } from "@virtool/contracts";
import { CacheParamError } from "../errors";

const CACHE_FLOAT = Symbol("cacheFloat");

/**
 * A number that must serialise as a float rather than an integer.
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
 * Mark a number as a float rather than an integer.
 *
 * An unmarked number serialises as an integer, and an integral value that is
 * really a float would then derive a different key: nuvs' `max_error_rate` and
 * `max_indel_rate` are floats defaulting to `0.1` and `0.03`, which happen to
 * round-trip identically — so the bug stays invisible until someone
 * configures `1.0`.
 */
export function float(value: number): CacheFloat {
	return { [CACHE_FLOAT]: true, value };
}

function isCacheFloat(value: object): value is CacheFloat {
	return CACHE_FLOAT in value;
}

// Outside this band the canonical float spelling and JavaScript's `String`
// disagree on whether to use exponential notation, and on how to spell the
// exponent when they agree — `1e16` canonicalises as `1e+16` where `String`
// gives `10000000000000000`, and `0.00001` canonicalises as `1e-05` where
// `String` gives `0.00001`. Rejecting is the honest option: no cache param in
// any workflow is near these bounds, and a silent divergence costs a
// permanently unshared namespace.
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
			`cannot derive a cache key from ${value}: the canonical form and JavaScript format numbers of this magnitude differently`,
		);
	}

	// Negative zero survives arithmetic in JavaScript but `String(-0)` is `"0"`,
	// where the canonical spelling is `"-0.0"`. Checked before the integral
	// branch, which would otherwise drop the sign and derive a different key.
	if (Object.is(value, -0)) {
		return "-0.0";
	}

	// `String` and the canonical spelling are both shortest-round-trip inside
	// the band, so they agree on everything but the trailing `.0` the canonical
	// form gives an integral float.
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
			// Iterating by code unit rather than code point is deliberate: the
			// format escapes an astral character as its two surrogates, which is
			// what `charCodeAt` already yields.
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
				`cannot derive a cache key from the non-ASCII param key ${JSON.stringify(key)}: the canonical form sorts keys by code point and JavaScript sorts by UTF-16 code unit`,
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

	return `{${Object.entries(record)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, entry]) => `${serializeKey(key)}:${serialize(entry)}`)
		.join(",")}}`;
}

/**
 * Serialise `params` to its exact canonical string.
 *
 * @throws {CacheParamError} on a non-ASCII key, an unmarked fractional number,
 *   or a number whose magnitude has no unambiguous canonical spelling.
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

/**
 * Strip the `float()` markers so params can be stored alongside the cache row.
 *
 * The marker exists only to make the *key* derivation correct, where an
 * integral float serialises as `1.0` and an integer as `1`. The stored params
 * are diagnostic — nothing looks a cache up by them — so losing that
 * distinction on the way into JSONB costs nothing, and matches what rows
 * already written record.
 */
export function toJsonCacheParams(params: CacheParams): JsonObject {
	return unwrap(params) as JsonObject;
}

function unwrap(value: CacheParamValue): JsonValue {
	if (Array.isArray(value)) {
		return value.map(unwrap);
	}

	if (typeof value === "object" && value !== null) {
		if (isCacheFloat(value)) {
			return value.value;
		}

		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, unwrap(entry)]),
		);
	}

	return value;
}
