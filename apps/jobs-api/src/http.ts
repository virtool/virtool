/**
 * The shape every deliberate 4xx in this service answers with.
 *
 * Returned, never thrown — the same reason `requireJobRequest` returns its
 * refusal. A thrown one would have to be caught where a genuine bug is caught
 * too, and Sentry would then see a routine rejection as an incident.
 */
export function jsonError(status: number, message: string): Response {
	return Response.json({ message }, { status });
}

/**
 * Parse a path parameter that names a row by its integer primary key.
 *
 * Returns `null` for anything that is not a positive integer, including the
 * `"1e3"` and `"1.5"` forms `Number.parseInt` would otherwise round into an id.
 */
export function parseRowId(value: string | undefined): number | null {
	if (value === undefined || !/^[1-9]\d*$/.test(value)) {
		return null;
	}

	const id = Number(value);

	return Number.isSafeInteger(id) ? id : null;
}
