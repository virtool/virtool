import { createFileRoute } from "@tanstack/react-router";
import AccountSetup from "@wall/components/AccountSetup";

export const Route = createFileRoute("/account-setup")({
	loader: async ({ context }) => {
		const { passwordPolicyQueryOptions } = await import(
			"@administration/passwordPolicy"
		);
		return context.queryClient.prefetchQuery(passwordPolicyQueryOptions());
	},
	component: AccountSetup,
});
