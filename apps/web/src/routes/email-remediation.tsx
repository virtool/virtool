import { getErrorStatus } from "@app/queryErrors";
import { safeRedirect } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";
import EmailRemediation from "@wall/components/EmailRemediation";

type EmailRemediationSearch = {
	redirect?: string;
};

function validateSearch(
	input: Partial<EmailRemediationSearch> & SearchSchemaInput,
): EmailRemediationSearch {
	return {
		redirect: safeRedirect(input.redirect),
	};
}

export const Route = createFileRoute("/email-remediation")({
	validateSearch,
	beforeLoad: async ({ context, search }) => {
		const { emailRemediationQueryOptions } = await import("@wall/queries");
		try {
			await context.queryClient.ensureQueryData(emailRemediationQueryOptions());
		} catch (error) {
			if (
				!(error instanceof Error) ||
				(error.name !== UNAUTHORIZED_ERROR_NAME &&
					getErrorStatus(error) !== 400)
			) {
				throw error;
			}
			throw redirect({
				to: "/login",
				replace: true,
				search: {
					reason: "remediation-expired",
					redirect: search.redirect,
				},
			});
		}
	},
	component: EmailRemediation,
});
