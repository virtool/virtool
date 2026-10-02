import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/groups")({
	beforeLoad: () => {
		throw redirect({ to: "/account/profile" });
	},
});
