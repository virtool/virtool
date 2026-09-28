import { useSuspenseAccount } from "@account/account";
import AccountGroups from "@account/components/AccountGroups";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/groups")({
	component: AccountGroupsRoute,
});

function AccountGroupsRoute() {
	const { data } = useSuspenseAccount();

	return <AccountGroups groups={data.groups} />;
}
