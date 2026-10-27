/** Normalize a search term without changing whitespace between words. */
export function normalizeSearchTerm(term: string): string {
	return term.trim();
}
