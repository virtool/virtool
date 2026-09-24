import AdministrationSidebar from "@administration/components/AdministrationSidebar";
import {
	AuthenticationCancel,
	AuthenticationPage,
	RecentAuthenticationForm,
} from "@app/recentAuthentication";
import Button from "@base/Button";
import { ContainerNarrow, ContainerWide } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { getRecentAuthenticationMethodsFn } from "@server/auth/recentAuthentication";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	redirect,
	useCanGoBack,
	useRouter,
} from "@tanstack/react-router";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/administration")({
	beforeLoad: async ({ context }) => {
		const { queryClient } = context;
		const { accountQueryOptions } = await import("@account/account");

		const account = await queryClient.ensureQueryData(accountQueryOptions());

		if (!hasSufficientAdminRole("users", account.administratorRole)) {
			throw redirect({ to: "/" });
		}
		const { isRecentAuthenticationFreshFn } = await import(
			"@server/auth/recentAuthentication"
		);
		const recentAuthenticationFresh = await isRecentAuthenticationFreshFn();

		return { account, recentAuthenticationFresh };
	},
	component: AdministrationLayout,
});

function AdministrationLayout() {
	const { account, recentAuthenticationFresh } = Route.useRouteContext();
	if (!recentAuthenticationFresh) {
		return <AdministrationAuthenticationGate />;
	}

	return (
		<ContainerWide>
			<ViewHeader title="Administration">
				<ViewHeaderTitle>Administration</ViewHeaderTitle>
			</ViewHeader>
			<div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:gap-10">
				<AdministrationSidebar administratorRole={account.administratorRole} />
				<ContainerNarrow>
					<Outlet />
				</ContainerNarrow>
			</div>
		</ContainerWide>
	);
}

function AdministrationAuthenticationGate() {
	const { account } = Route.useRouteContext();
	const router = useRouter();
	const canGoBack = useCanGoBack();

	function onCancel() {
		if (canGoBack) {
			router.history.back();
		} else {
			void router.navigate({ to: "/jobs", replace: true });
		}
	}
	const [error, setError] = useState<string | null>(null);
	const methodsQuery = useQuery({
		queryKey: ["recent-authentication-methods", account.id],
		queryFn: getRecentAuthenticationMethodsFn,
	});

	function onSuccess() {
		void router.invalidate().catch((cause: unknown) => {
			setError(
				cause instanceof Error
					? cause.message
					: "Unable to open Administration.",
			);
		});
	}

	return (
		<AuthenticationPage>
			{error ? (
				<p role="alert" className="mb-4 text-red-600">
					{error}
				</p>
			) : null}
			{methodsQuery.isError ? (
				<div className="grid justify-items-center gap-4">
					<p role="alert">Unable to load verification methods.</p>
					<Button
						className="w-full justify-center"
						onClick={() => void methodsQuery.refetch()}
					>
						Try again
					</Button>
					<AuthenticationCancel onClick={onCancel} />
				</div>
			) : (
				<RecentAuthenticationForm
					methods={methodsQuery.data ?? null}
					onFailure={(cause) => setError(cause.message)}
					onSuccess={onSuccess}
					secondaryAction={<AuthenticationCancel onClick={onCancel} />}
					submitLabel="Continue"
				/>
			)}
		</AuthenticationPage>
	);
}
