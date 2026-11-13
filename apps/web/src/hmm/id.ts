/**
 * The HMM row id a path segment names, or null when it names none.
 *
 * The path segment is whatever the URL carried, so it need not be a row id at
 * all. Fetching on a `NaN` reaches the server function's validator, which
 * rejects it as an unhandled 500 rather than the not-found this is.
 */
export function parseHmmId(segment: string): number | null {
	const id = Number(segment);

	return Number.isSafeInteger(id) && id >= 1 ? id : null;
}
