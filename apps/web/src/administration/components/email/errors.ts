import { CLIENT_ERROR_NAME } from "@virtool/contracts";

/**
 * Pull a server-provided message off a rejected email mutation.
 *
 * Only a `ClientError` is shown. It is the deliberate refusal — an
 * incomplete configuration, an unusable encryption key — written to be read by
 * an administrator. Anything else is unexpected and its `message` crosses the
 * boundary verbatim, so rendering it would put an internal diagnostic on
 * screen.
 */
export function getEmailErrorMessage(error: unknown): string {
	const fallback = "Something went wrong. Please try again.";

	if (!(error instanceof Error) || error.name !== CLIENT_ERROR_NAME) {
		return fallback;
	}

	return error.message || fallback;
}
