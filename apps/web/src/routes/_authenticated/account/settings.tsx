import AccountSettings from "@account/components/AccountSettings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/settings")({
	component: AccountSettings,
});
