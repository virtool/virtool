import { createFileRoute, redirect } from "@tanstack/react-router";
import FirstUser from "@wall/components/FirstUser";

export const Route = createFileRoute("/setup")({
	// Bootstrap is not registration. Once a user exists the form is gone.
	beforeLoad: async ({ context }) => {
		const { rootQueryOptions } = await import("@nav/queries");
		const root = await context.queryClient.ensureQueryData(rootQueryOptions());
		if (!root.firstUser) {
			throw redirect({ to: "/login", replace: true });
		}
	},
	// prefetchQuery rather than ensureQueryData: a failed policy read must not
	// take down setup. The form then applies no length rule and the server, which
	// is authoritative, rejects a short password with a message quoting it.
	loader: async ({ context }) => {
		const { passwordPolicyQueryOptions } = await import(
			"@administration/passwordPolicy"
		);
		return context.queryClient.prefetchQuery(passwordPolicyQueryOptions());
	},
	component: FirstUser,
});
