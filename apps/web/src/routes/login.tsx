import { oneOfOptional, safeRedirect } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginWall from "@wall/components/LoginWall";

/** Search params for the login wall. */
type LoginSearch = {
	reason?: "remediation-expired" | "session-ended" | "setup-complete";
	redirect?: string;
};

function validateLoginSearch(
	input: Partial<LoginSearch> & SearchSchemaInput,
): LoginSearch {
	return {
		reason: oneOfOptional(input.reason, [
			"remediation-expired",
			"session-ended",
			"setup-complete",
		] as const),
		redirect: safeRedirect(input.redirect),
	};
}

export const Route = createFileRoute("/login")({
	validateSearch: validateLoginSearch,
	beforeLoad: async ({ context, search }) => {
		const { queryClient } = context;
		const [{ accountQueryOptions }, { getAuthNextStep, getAuthNextStepRoute }] =
			await Promise.all([import("@account/account"), import("@wall/nextStep")]);

		try {
			await queryClient.ensureQueryData(accountQueryOptions());
		} catch (error) {
			const step = getAuthNextStep(error);
			if (
				step?.type === "email_remediation" ||
				step?.type === "mfa_enrollment"
			) {
				throw redirect(getAuthNextStepRoute(step, search.redirect));
			}
			return { passwordResetRequired: step?.type === "password_reset" };
		}

		throw redirect({ to: search.redirect ?? "/" });
	},
	// The forced-reset form needs the policy up front. A failed policy read must
	// not take down the wall, so prefetch rather than ensuring the query.
	loader: async ({ context }) => {
		const { passwordPolicyQueryOptions } = await import(
			"@administration/passwordPolicy"
		);
		return context.queryClient.prefetchQuery(passwordPolicyQueryOptions());
	},
	component: LoginWall,
});
