import { ContainerNarrow, ContainerWide } from "@base/Container";
import { NavTab, NavTabs } from "@base/Nav";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account")({
	component: AccountLayout,
});

function AccountLayout() {
	return (
		<ContainerWide>
			<ViewHeader title="Account">
				<ViewHeaderTitle>Account</ViewHeaderTitle>
			</ViewHeader>

			<NavTabs>
				<NavTab to="/account/profile">Profile</NavTab>
				<NavTab to="/account/api">API</NavTab>
			</NavTabs>

			<ContainerNarrow>
				<Outlet />
			</ContainerNarrow>
		</ContainerWide>
	);
}
