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
	loader: async ({ context: { queryClient } }) => {
		const { settingsQueryOptions } = await import("@administration/queries");
		await queryClient.ensureQueryData(settingsQueryOptions());
	},
	component: CacheStorageBudget,
});
