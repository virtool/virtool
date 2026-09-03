/** The characters a handle may contain. */
const HANDLE_PATTERN = /^[a-zA-Z0-9_.]+$/;

/** The fewest characters a handle may have. */
export const HANDLE_MIN_LENGTH = 3;

/** The most characters a handle may have. */
export const HANDLE_MAX_LENGTH = 30;

/** Report whether a handle has a shape Better Auth can authenticate. */
export function isValidHandle(handle: string): boolean {
	return (
		handle.length >= HANDLE_MIN_LENGTH &&
		handle.length <= HANDLE_MAX_LENGTH &&
		HANDLE_PATTERN.test(handle)
	);
}
