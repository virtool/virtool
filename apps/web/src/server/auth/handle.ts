import { setResponseStatus } from "@tanstack/react-start/server";
import { ClientError } from "../errors";

/** The characters a handle may contain. */
const HANDLE_PATTERN = /^[a-zA-Z0-9_.]+$/;

/** The fewest characters a handle may have. */
export const HANDLE_MIN_LENGTH = 3;

/** The most characters a handle may have. */
export const HANDLE_MAX_LENGTH = 30;

/**
 * Report whether a handle has a usable shape.
 *
 * Better Auth matches a sign-in against this same rule before it looks the user
 * up, so a handle this rejects is one that could be created but never used.
 */
export function isValidHandle(handle: string): boolean {
	return (
		handle.length >= HANDLE_MIN_LENGTH &&
		handle.length <= HANDLE_MAX_LENGTH &&
		HANDLE_PATTERN.test(handle)
	);
}

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
