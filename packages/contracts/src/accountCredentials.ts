import { INVALID_EMAIL_MESSAGE, isValidEmail } from "./emailAddress";
import { checkPasswordLength } from "./passwordPolicy";
import {
	INVALID_USERNAME_MESSAGE,
	isReservedUsername,
	isValidUsername,
	normalizeUsername,
	RESERVED_USERNAME_MESSAGE,
} from "./username";

/** The username, email, and password for a new account. */
export type AccountCredentials = {
	email: string;
	username: string;
	password: string;
};

/**
 * Check new account credentials against the username, email, and password
 * rules.
 *
 * The username is checked in its normalized form, so the caller may pass it in
 * any case. Throws an `Error` with a message that a form can show to the user.
 */
export function checkAccountCredentials(
	credentials: AccountCredentials,
	minimumPasswordLength: number,
): void {
	const username = normalizeUsername(credentials.username);
	if (!isValidUsername(username)) {
		throw new Error(INVALID_USERNAME_MESSAGE);
	}
	if (isReservedUsername(username)) {
		throw new Error(RESERVED_USERNAME_MESSAGE);
	}
	if (!isValidEmail(credentials.email)) {
		throw new Error(INVALID_EMAIL_MESSAGE);
	}
	checkPasswordLength(credentials.password, minimumPasswordLength);
}
