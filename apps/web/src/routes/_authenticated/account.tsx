import AccountSidebar from "@account/components/AccountSidebar";
import { ContainerNarrow, ContainerWide } from "@base/Container";
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
			<div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-10">
				<AccountSidebar />
				<ContainerNarrow>
					<Outlet />
				</ContainerNarrow>
			</div>
		</ContainerWide>
	);
}
