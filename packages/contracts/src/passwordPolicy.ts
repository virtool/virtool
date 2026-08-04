/**
 * The password length rule. The forms need the same rule the server enforces —
 * and the same message — or a password that passes client validation gets
 * rejected on submit with different wording.
 */

/**
 * The minimum length applied when the configured value isn't available.
 *
 * The unauthenticated forms render before their policy query resolves, and the
 * settings row may not exist at all on a database Python has never booted
 * against. Both fall back to this, which is why `DEFAULT_SETTINGS` seeds it.
 */
export const DEFAULT_MINIMUM_PASSWORD_LENGTH = 8;

/** Raised when a password being set is shorter than the configured minimum. */
export class PasswordTooShortError extends Error {
	constructor(readonly minimum: number) {
		super(formatMinimumPasswordLengthMessage(minimum));
		this.name = "PasswordTooShortError";
	}
}

/** Build the message shown when a password is too short. */
export function formatMinimumPasswordLengthMessage(minimum: number): string {
	return `Password does not meet minimum length requirement (${minimum})`;
}

/**
 * Check a password being set against the configured minimum length.
 *
 * Not applied at login: a user whose stored password predates the current
 * minimum must still be able to authenticate, or they could never reach the
 * forced-reset flow that would replace it.
 */
export function checkPasswordLength(password: string, minimum: number): void {
	if (password.length < minimum) {
		throw new PasswordTooShortError(minimum);
	}
}
