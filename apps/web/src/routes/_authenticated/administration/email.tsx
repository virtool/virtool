import EmailDelivery from "@administration/components/email/EmailDelivery";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";

export const Route = createFileRoute("/_authenticated/administration/email")({
	beforeLoad: ({ context }) => {
		if (!hasSufficientAdminRole("full", context.account.administratorRole)) {
			throw redirect({ to: "/administration/users" });
		}
	},
	loader: async ({ context: { queryClient } }) => {
		const { emailSettingsQueryOptions } = await import(
			"@administration/queries"
		);
		await queryClient.ensureQueryData(emailSettingsQueryOptions());
	},
	component: EmailDelivery,
});
