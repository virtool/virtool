import { accountQueryKeys } from "@account/keys";
import { getErrorStatus } from "@app/queryErrors";
import { safeRedirect } from "@app/searchParams";
import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";
import { rootQueryKeys } from "@wall/keys";

export const Route = createFileRoute("/email-remediation-verify")({
	validateSearch: (input: Record<string, unknown>) => ({
		redirect: safeRedirect(input.redirect),
		token: typeof input.token === "string" ? input.token : undefined,
	}),
	beforeLoad: async ({ context, search }) => {
		if (!search.token || !/^[0-9a-f]{64}$/.test(search.token)) {
			throw redirect({
				to: "/email-remediation",
				replace: true,
				search: { error: "invalid-link", redirect: search.redirect },
			});
		}

		try {
			const { completeEmailRemediation } = await import("@wall/queries");
			await completeEmailRemediation(search.token);
			context.queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			context.queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			throw redirect({ to: search.redirect ?? "/", replace: true });
		} catch (error) {
			if (isRedirect(error)) {
				throw error;
			}
			if (
				!(error instanceof Error) ||
				(error.name !== UNAUTHORIZED_ERROR_NAME &&
					getErrorStatus(error) !== 400)
			) {
				throw error;
			}
			throw redirect({
				to: "/email-remediation",
				replace: true,
				search: { error: "invalid-link", redirect: search.redirect },
			});
		}
	},
});
