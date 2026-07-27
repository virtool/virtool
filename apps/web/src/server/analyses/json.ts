// Structural reads over a workflow's raw `results` blob. Its keys are the
// worker's contract and stay exactly as the workflow wrote them, so the blob is
// read structurally rather than through a declared shape — every access coerces
// to the type the caller needs instead of asserting one.

/** `value` as a plain object, or null if it is an array, null, or a primitive. */
export function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

/** `value` as an array, or an empty array if it is not one. */
export function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/** `value` as a number, or `fallback` if it is not one. */
export function asNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" ? value : fallback;
}

/**
 * `value` as a string, or `""` if it is not one — for a field the blob stores as
 * text, where a non-string means the field is absent.
 */
export function asText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * `value` stringified — for an identifier the blob may hold as either a string or
 * a number, where both spellings name the same thing. Unlike {@link asText} a
 * number survives as its digits rather than becoming `""`.
 */
export function asString(value: unknown): string {
	return typeof value === "string" ? value : String(value);
}
