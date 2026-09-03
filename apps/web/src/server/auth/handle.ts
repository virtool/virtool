import { setResponseStatus } from "@tanstack/react-start/server";
import {
	HANDLE_MAX_LENGTH,
	HANDLE_MIN_LENGTH,
	isValidHandle,
} from "@virtool/data/auth/handle";
import { ClientError } from "../errors";

export { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, isValidHandle };

/**
 * Reject a handle that cannot be signed in with.
 *
 * Checked here rather than in a validator because a zod rejection surfaces as a
 * 500 carrying the issue list, which is not something a form can put in front
 * of a user.
 */
export function checkHandle(handle: string): void {
	if (!isValidHandle(handle.trim())) {
		setResponseStatus(400);
		throw new ClientError(
			`User name must have ${HANDLE_MIN_LENGTH} to ${HANDLE_MAX_LENGTH} characters, and use only letters, numbers, and _ .`,
		);
	}
}

/**
 * Reject the reserved handle.
 *
 * Checked before the database so the caller gets this message rather than a
 * unique-constraint error. Trims defensively so a padded variant like
 * `" virtool"` cannot slip past a caller that skips the schema's trim.
 */
export function checkReservedHandle(handle: string): void {
	if (handle.trim().toLowerCase() === "virtool") {
		setResponseStatus(400);
		throw new ClientError("Reserved user name: virtool");
	}
}
