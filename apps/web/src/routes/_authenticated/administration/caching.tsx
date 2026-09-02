import CacheStorageBudget from "@administration/components/CacheStorageBudget";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";

export const Route = createFileRoute("/_authenticated/administration/caching")({
	beforeLoad: ({ context }) => {
		if (
			!hasSufficientAdminRole("settings", context.account.administratorRole)
		) {
			throw redirect({ to: "/administration/users" });
		}
	},
	component: CacheStorageBudget,
});
