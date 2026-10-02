/** The characters a handle may contain. */
const HANDLE_PATTERN = /^[a-zA-Z0-9_.]+$/;

/** The fewest characters a handle may have. */
export const HANDLE_MIN_LENGTH = 3;

/** The most characters a handle may have. */
export const HANDLE_MAX_LENGTH = 30;

/** The handle the system account holds, which no user may take. */
const RESERVED_HANDLE = "virtool";

/** The message shown when a handle does not have a valid shape. */
export const INVALID_HANDLE_MESSAGE = `User name must have ${HANDLE_MIN_LENGTH} to ${HANDLE_MAX_LENGTH} characters, and use only letters, numbers, and _ .`;

/** The message shown when a user tries to take the reserved handle. */
export const RESERVED_HANDLE_MESSAGE = `Reserved user name: ${RESERVED_HANDLE}`;

/** Report whether a handle has a shape Better Auth can authenticate. */
export function isValidHandle(handle: string): boolean {
	return (
		handle.length >= HANDLE_MIN_LENGTH &&
		handle.length <= HANDLE_MAX_LENGTH &&
		HANDLE_PATTERN.test(handle)
	);
}

/** Report whether a handle is reserved, ignoring case. */
export function isReservedHandle(handle: string): boolean {
	return handle.toLowerCase() === RESERVED_HANDLE;
}
