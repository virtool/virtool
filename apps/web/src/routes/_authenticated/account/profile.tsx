import AccountProfile from "@account/components/AccountProfile";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/profile")({
	loader: async ({ context: { queryClient } }) => {
		const [{ passwordPolicyQueryOptions }, { emailDeliveryQueryOptions }] =
			await Promise.all([
				import("@administration/passwordPolicy"),
				import("@account/queries"),
			]);
		await Promise.all([
			queryClient.prefetchQuery(passwordPolicyQueryOptions()),
			queryClient.prefetchQuery(emailDeliveryQueryOptions()),
		]);
	},
	component: AccountProfile,
});
