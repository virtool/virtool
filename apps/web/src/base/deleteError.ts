import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import { CLIENT_ERROR_NAME } from "@virtool/contracts";

/**
 * Pull a server-provided message off a rejected deletion, if there is one.
 * A cancelled recent-authentication challenge has no message.
 *
 * Only a `ClientError` is shown. It is the deliberate refusal — a name
 * conflict, a missing row — written to be read by the user. Anything else is
 * unexpected, and `ShallowErrorPlugin` carries its `message` across the
 * boundary verbatim, so rendering it would put a database or storage
 * diagnostic on screen.
 */
export function getDeleteErrorMessage(error: unknown): string | null {
	const fallback = "Something went wrong. Please try again.";

	if (isRecentAuthenticationCancelled(error)) {
		return null;
	}

	if (!(error instanceof Error) || error.name !== CLIENT_ERROR_NAME) {
		return fallback;
	}

	return error.message || fallback;
}
