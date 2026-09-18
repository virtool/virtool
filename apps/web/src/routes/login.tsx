import { oneOfOptional, strOptional } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
} from "@virtool/contracts";
import LoginWall from "@wall/components/LoginWall";

function isSafeRedirect(value: string): boolean {
	return (
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.startsWith("/login")
	);
}

/** Search params for the login wall. */
type LoginSearch = {
	reason?: "remediation-expired" | "session-ended";
	redirect?: string;
};

function validateLoginSearch(
	input: Partial<LoginSearch> & SearchSchemaInput,
): LoginSearch {
	const target = strOptional(input.redirect);

	return {
		reason: oneOfOptional(input.reason, [
			"remediation-expired",
			"session-ended",
		] as const),
		redirect: target && isSafeRedirect(target) ? target : undefined,
	};
}

export const Route = createFileRoute("/login")({
	validateSearch: validateLoginSearch,
	beforeLoad: async ({ context, search }) => {
		const { queryClient } = context;
		const { accountQueryOptions } = await import("@account/account");

		try {
			await queryClient.ensureQueryData(accountQueryOptions());
		} catch (error) {
			if (
				error instanceof Error &&
				error.name === SETUP_REQUIRED_ERROR_NAME &&
				(error as Error & { purpose?: string }).purpose === "email_remediation"
			) {
				throw redirect({ to: "/email-remediation" });
			}
			return {
				passwordResetRequired:
					error instanceof Error &&
					error.name === PASSWORD_RESET_REQUIRED_ERROR_NAME,
			};
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
