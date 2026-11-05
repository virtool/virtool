import {
	MFA_ENROLLMENT_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";

/** The screen that the server's view of the browser's principal calls for. */
export type AuthNextStep =
	| { type: "application" }
	| { type: "login" }
	| { type: "email_remediation" }
	| { type: "mfa_enrollment" };

/**
 * Read the next step from an account-fetch rejection.
 *
 * Returns `null` for an error that says nothing about the principal, such as a
 * network failure.
 */
export function getAuthNextStep(error: unknown): AuthNextStep | null {
	if (!(error instanceof Error)) {
		return null;
	}

	switch (error.name) {
		case UNAUTHORIZED_ERROR_NAME:
			return { type: "login" };
		case MFA_ENROLLMENT_REQUIRED_ERROR_NAME:
			return { type: "mfa_enrollment" };
		case SETUP_REQUIRED_ERROR_NAME:
			// The other setup purposes have no wall that a session can resume, so
			// the holder signs in again.
			return (error as Error & { purpose?: string }).purpose ===
				"email_remediation"
				? { type: "email_remediation" }
				: { type: "login" };
		default:
			return null;
	}
}
