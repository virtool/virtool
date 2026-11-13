function getPattern(match: string, isRegex: boolean) {
	try {
		const source = isRegex
			? match
			: match
					.split(/\*+/)
					.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
					.join(".*");
		return { pattern: new RegExp(source, "g"), error: null };
	} catch {
		return { pattern: null, error: "Enter a valid regular expression." };
	}
}

/**
 * Rename every name that matches.
 *
 * A literal match treats `*` as a wildcard and inserts the replacement as
 * written. A regular expression match accepts the replacement patterns that
 * `String.prototype.replace` does. An invalid regular expression renames
 * nothing and returns an error to show.
 */
export function renameNames(
	names: string[],
	match: string,
	replacement: string,
	isRegex: boolean,
): { error: string | null; renamed: string[] } {
	const { pattern, error } = getPattern(match, isRegex);

	if (!match || !pattern) {
		return { error, renamed: names };
	}

	return {
		error,
		renamed: names.map((name) =>
			isRegex
				? name.replace(pattern, replacement)
				: // A function inserts the replacement as written, with no `$`
					// patterns. An empty match, which a standalone wildcard makes at the
					// end of a name, is left empty so the name is replaced only once.
					name.replace(pattern, (matched) => (matched ? replacement : "")),
		),
	};
}
