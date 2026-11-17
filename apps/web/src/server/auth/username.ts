import {
	INVALID_USERNAME_MESSAGE,
	isReservedUsername,
	isValidUsername,
	normalizeUsername,
	RESERVED_USERNAME_MESSAGE,
} from "@virtool/contracts";
import { ClientError } from "../errors";

/**
 * Reject a username that cannot be signed in with, in any case.
 *
 * Checked here rather than in a validator because a zod rejection surfaces as a
 * 500 carrying the issue list, which is not something a form can put in front
 * of a user.
 */
export function checkUsername(username: string): void {
	if (!isValidUsername(normalizeUsername(username))) {
		throw new ClientError(INVALID_USERNAME_MESSAGE, 400);
	}
}

/**
 * Reject the reserved username.
 *
 * Checked before the database so the caller gets this message rather than a
 * unique-constraint error.
 */
export function checkReservedUsername(username: string): void {
	if (isReservedUsername(username)) {
		throw new ClientError(RESERVED_USERNAME_MESSAGE, 400);
	}
}
