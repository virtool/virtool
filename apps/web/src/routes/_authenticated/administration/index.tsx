import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";

export const Route = createFileRoute("/_authenticated/administration/")({
	beforeLoad: async ({ context }) => {
		const { queryClient } = context;
		const { accountQueryOptions } = await import("@account/account");

		const account = await queryClient.ensureQueryData(accountQueryOptions());

		if (hasSufficientAdminRole("settings", account.administratorRole)) {
			throw redirect({ to: "/administration/settings" });
		}

		throw redirect({ to: "/administration/users" });
	},
});
