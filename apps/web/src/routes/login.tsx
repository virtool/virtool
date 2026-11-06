import { isServiceUnavailable } from "@app/queryErrors";
import { oneOfOptional } from "@app/searchParams";
import { safeRedirect } from "@server/auth/redirect";
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
		const [
			{ accountQueryOptions },
			{ getAuthNextStep },
			{ getAuthNextStepRoute },
		] = await Promise.all([
			import("@account/account"),
			import("@wall/authStep"),
			import("@wall/nextStep"),
		]);

		try {
			await queryClient.ensureQueryData(accountQueryOptions());
		} catch (error) {
			if (isServiceUnavailable(error)) {
				throw error;
			}
			const step = getAuthNextStep(error);
			if (
				step?.type === "email_remediation" ||
				step?.type === "mfa_enrollment"
			) {
				throw redirect(getAuthNextStepRoute(step, search.redirect));
			}
			return {};
		}

		throw redirect({ href: search.redirect ?? "/" });
	},
	component: LoginWall,
});
