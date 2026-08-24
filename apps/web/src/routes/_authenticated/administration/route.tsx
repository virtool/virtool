import AdministrationTabs from "@administration/components/AdministrationTabs";
import { ContainerNarrow, ContainerWide } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";

export const Route = createFileRoute("/_authenticated/administration")({
	beforeLoad: async ({ context }) => {
		const { queryClient } = context;
		const { accountQueryOptions } = await import("@account/account");

		const account = await queryClient.ensureQueryData(accountQueryOptions());

		if (!hasSufficientAdminRole("users", account.administratorRole)) {
			throw redirect({ to: "/" });
		}

		return { account };
	},
	component: AdministrationLayout,
});

function AdministrationLayout() {
	const { account } = Route.useRouteContext();

	return (
		<ContainerWide>
			<ViewHeader title="Administration">
				<ViewHeaderTitle>Administration</ViewHeaderTitle>
			</ViewHeader>
			<AdministrationTabs administratorRole={account.administratorRole} />
			<ContainerNarrow>
				<Outlet />
			</ContainerNarrow>
		</ContainerWide>
	);
}
