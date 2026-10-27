import AccountSecurity from "@account/components/AccountSecurity";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/security")({
	loader: async ({ context: { queryClient } }) => {
		const [
			{ passwordPolicyQueryOptions },
			{ accountSecurityQueryOptions, emailDeliveryQueryOptions },
		] = await Promise.all([
			import("@administration/passwordPolicy"),
			import("@account/queries"),
		]);
		await Promise.all([
			queryClient.prefetchQuery(passwordPolicyQueryOptions()),
			queryClient.prefetchQuery(emailDeliveryQueryOptions()),
			queryClient.prefetchQuery(accountSecurityQueryOptions()),
		]);
	},
	component: AccountSecurity,
});
