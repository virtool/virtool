/** Capitalize an isolate name type for display. */
export function getIsolateNameTypeLabel(type: string): string {
	return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/** Format a v2 isolate name for display. */
export function formatV2IsolateName(
	name: { type: string; value: string } | null,
): string {
	return name
		? `${getIsolateNameTypeLabel(name.type)} ${name.value}`
		: "Unnamed isolate";
}
