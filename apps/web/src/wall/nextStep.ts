import { accountQueryOptions } from "@account/account";
import type { QueryClient } from "@tanstack/react-query";
import type { NavigateOptions } from "@tanstack/react-router";
import { type AuthNextStep, getAuthNextStep } from "@wall/authStep";
import { rootQueryKeys } from "@wall/keys";

/**
 * Drop every cache that the previous principal filled, then ask the server
 * which step comes next.
 *
 * Call this after each sign-in or setup transition. Local success is not proof
 * that a restriction has lifted. The route guards read the same mapping, so a
 * restricted principal never renders the application shell.
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
export function getAuthNextStepRoute(
	step: AuthNextStep,
	redirect?: string,
): NavigateOptions {
	switch (step.type) {
		case "application":
			// The redirect is a full path, which only `href` splits into a path,
			// search, and hash.
			return { href: redirect ?? "/" };
		case "login":
			return { to: "/login", search: { redirect } };
		case "email_remediation":
			return { to: "/email-remediation", search: { redirect } };
		case "mfa_enrollment":
			return { to: "/mfa-enrollment", search: { redirect } };
		default: {
			const unhandled: never = step;
			throw new Error(`Unhandled auth step: ${JSON.stringify(unhandled)}`);
		}
	}
}
