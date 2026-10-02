import AccountProfile from "@account/components/AccountProfile";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/profile")({
	component: AccountProfile,
});
