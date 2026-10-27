import { INVALID_EMAIL_MESSAGE, isValidEmail } from "./emailAddress";
import {
	INVALID_HANDLE_MESSAGE,
	isReservedHandle,
	isValidHandle,
	RESERVED_HANDLE_MESSAGE,
} from "./handle";
import { checkPasswordLength } from "./passwordPolicy";

/** The handle, email, and password for a new account. */
export type AccountCredentials = {
	email: string;
	handle: string;
	password: string;
};

/**
 * Check new account credentials against the handle, email, and password rules.
 *
 * Throws an `Error` with a message that a form can show to the user.
 */
export function checkAccountCredentials(
	credentials: AccountCredentials,
	minimumPasswordLength: number,
): void {
	if (!isValidHandle(credentials.handle)) {
		throw new Error(INVALID_HANDLE_MESSAGE);
	}
	if (isReservedHandle(credentials.handle)) {
		throw new Error(RESERVED_HANDLE_MESSAGE);
	}
	if (!isValidEmail(credentials.email)) {
		throw new Error(INVALID_EMAIL_MESSAGE);
	}
	checkPasswordLength(credentials.password, minimumPasswordLength);
}
