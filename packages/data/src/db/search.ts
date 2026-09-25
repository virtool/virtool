/**
 * Return an `ILIKE` pattern that matches rows containing `term`. The LIKE
 * metacharacters in `term` are escaped with Postgres's default `\` escape
 * character, so a user's `%` or `_` matches literally.
 */
export function toSearchPattern(term: string): string {
	return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
