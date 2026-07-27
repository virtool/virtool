/**
 * An isolate's canonical display name, as Python's `format_isolate_name`
 * composes it: the capitalised source type followed by the source name.
 *
 * Either field being absent or empty yields the `"Unnamed Isolate"` sentinel —
 * a name is only meaningful with both halves. The source type is lower-cased
 * past its first character to match Python's `str.capitalize`, so an isolate
 * stored as `ISOLATE` renders the same on both sides.
 *
 * Read structurally rather than through a declared isolate type: the callers
 * hold OTU documents at several different stages of patching, and all of them
 * carry these two fields.
 */
export function formatIsolateName(isolate: {
	source_name?: unknown;
	source_type?: unknown;
}): string {
	const sourceType =
		typeof isolate.source_type === "string" ? isolate.source_type : "";
	const sourceName =
		typeof isolate.source_name === "string" ? isolate.source_name : "";

	if (!sourceType || !sourceName) {
		return "Unnamed Isolate";
	}

	return `${sourceType.charAt(0).toUpperCase()}${sourceType.slice(1).toLowerCase()} ${sourceName}`;
}
