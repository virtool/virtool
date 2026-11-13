/** The characters a stored username may contain. */
const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

/** The fewest characters a username may have. */
export const USERNAME_MIN_LENGTH = 3;

/** The most characters a username may have. */
export const USERNAME_MAX_LENGTH = 30;

/** The username the system account holds, which no user may take. */
const RESERVED_USERNAME = "virtool";

/** The message shown when a username does not have a valid shape. */
export const INVALID_USERNAME_MESSAGE = `Username must have ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters, and use only letters, numbers, and _ .`;

/** The message shown when a user tries to take the reserved username. */
export const RESERVED_USERNAME_MESSAGE = `Reserved username: ${RESERVED_USERNAME}`;

/**
 * Fold a typed username to the form it is stored and compared in.
 *
 * Users type a username in any case. Every write and every lookup goes through
 * this, so `Ada` and `ada` are the same account.
 */
export function normalizeUsername(username: string): string {
	return username.trim().toLowerCase();
}

/** Report whether a normalized username has a shape that can be stored. */
export function isValidUsername(username: string): boolean {
	return (
		username.length >= USERNAME_MIN_LENGTH &&
		username.length <= USERNAME_MAX_LENGTH &&
		USERNAME_PATTERN.test(username)
	);
}

/** Report whether a username is reserved, in any case. */
export function isReservedUsername(username: string): boolean {
	return normalizeUsername(username) === RESERVED_USERNAME;
}
