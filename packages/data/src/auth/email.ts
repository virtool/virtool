/**
 * The normalized form of an email address.
 *
 * Trims surrounding whitespace and folds case. Provider-specific rules such as
 * dot removal and plus-address stripping are intentionally excluded.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Report whether an address has a usable shape.
 *
 * Deliberately loose to avoid rejecting deliverable addresses; delivery proves
 * the rest.
 */
export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
