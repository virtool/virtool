// Email normalization and validation, defined once.
//
// The legacy migration, the `users_migrated_email_unique` index and the account
// email form all decide the same question — whether two addresses are the same
// address — and they have to answer it identically. The index expression is
// `lowerTrim` in `src/db/schema/sql.ts`.

/**
 * The normalized form of an email address.
 *
 * Surrounding whitespace goes and case is folded. Nothing else: dot removal and
 * plus-address stripping are provider-specific rules, and applying them would
 * merge addresses that a provider outside that convention delivers to different
 * people.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Report whether an address has a usable shape.
 *
 * Deliberately loose. A stricter grammar would reject deliverable addresses,
 * and this decides only whether an address is worth carrying into Better Auth —
 * delivery proves the rest.
 */
export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
