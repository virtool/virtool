import { accountQueryOptions } from "@account/account";
import type { QueryClient } from "@tanstack/react-query";
import {
	MFA_ENROLLMENT_REQUIRED_ERROR_NAME,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { rootQueryKeys } from "@wall/keys";

/** The screen that the server's view of the browser's principal calls for. */
export type AuthNextStep =
	| { type: "application" }
	| { type: "login" }
	| { type: "password_reset" }
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
		case PASSWORD_RESET_REQUIRED_ERROR_NAME:
			return { type: "password_reset" };
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

/**
 * Drop every cache that the previous principal filled, then ask the server
 * which step comes next.
 *
 * Call this after each sign-in or setup transition. Local success is not proof
 * that a restriction has lifted.
 */
export async function resolveAuthNextStep(
	queryClient: QueryClient,
): Promise<AuthNextStep> {
	queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
	queryClient.removeQueries({ queryKey: accountQueryOptions().queryKey });

	try {
		await queryClient.fetchQuery(accountQueryOptions());
		return { type: "application" };
	} catch (error) {
		const step = getAuthNextStep(error);
		if (step === null) {
			throw error;
		}
		return step;
	}
}

/** The route for a step, carrying a validated redirect where it applies. */
export function getAuthNextStepRoute(step: AuthNextStep, redirect?: string) {
	switch (step.type) {
		case "application":
			return { to: redirect ?? "/" };
		case "login":
		case "password_reset":
			return { to: "/login" as const, search: { redirect } };
		case "email_remediation":
			return { to: "/email-remediation" as const, search: { redirect } };
		case "mfa_enrollment":
			return { to: "/mfa-enrollment" as const, search: { redirect } };
		default: {
			const unhandled: never = step;
			throw new Error(`Unhandled auth step: ${JSON.stringify(unhandled)}`);
		}
	}
}
