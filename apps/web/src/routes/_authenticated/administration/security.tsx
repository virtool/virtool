import MfaPolicy from "@administration/components/MfaPolicy";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";

export const Route = createFileRoute("/_authenticated/administration/security")(
	{
		beforeLoad: ({ context }) => {
			if (!hasSufficientAdminRole("full", context.account.administratorRole)) {
				throw redirect({ to: "/administration/users" });
			}
		},
		loader: async ({ context: { queryClient } }) => {
			const { settingsQueryOptions } = await import("@administration/queries");
			await queryClient.ensureQueryData(settingsQueryOptions());
		},
		component: MfaPolicy,
	},
);
