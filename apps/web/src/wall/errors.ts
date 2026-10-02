import { CLIENT_ERROR_NAME } from "@virtool/contracts";

/**
 * The message to show for a failed wall request.
 *
 * Only a `ClientError` carries a message written for the user. Anything else
 * can hold library or provider details, so it gets the fallback.
 */
export function getWallErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error &&
		error.name === CLIENT_ERROR_NAME &&
		error.message
		? error.message
		: fallback;
}
