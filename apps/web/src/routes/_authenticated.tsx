import { useFetchAccount } from "@account/account";
import { CONTENT_SCROLL_ID } from "@app/scroll";
import { armSessionEnd } from "@app/session";
import * as Sse from "@app/sse/SseConnection";
import Banner from "@banner/components/Banner";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import SkipLink from "@base/SkipLink";
import Nav from "@nav/components/Nav";
import Sidebar from "@nav/components/Sidebar";
import UpdateToast from "@nav/components/UpdateToast";
import * as Sentry from "@sentry/tanstackstart-react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Navigate,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";

const UploadOverlay = lazy(() => import("@uploads/components/UploadOverlay"));

function setupSse(queryClient: QueryClient) {
	Sse.init(queryClient);
	if (Sse.getConnectionStatus() === "initializing") {
		Sse.establishConnection();
	}
}

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context, location }) => {
		const { queryClient } = context;

		const [{ rootQueryOptions }, { accountQueryOptions }] = await Promise.all([
			import("@nav/queries"),
			import("@account/account"),
		]);

		const rootData = await queryClient.ensureQueryData(rootQueryOptions());

		if (rootData.firstUser) {
			throw redirect({ to: "/setup" });
		}

		try {
			await queryClient.ensureQueryData(accountQueryOptions());
		} catch {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const queryClient = useQueryClient();
	const { data, isPending } = useFetchAccount();
	const location = useLocation();

	useEffect(() => {
		if (data) {
			// A 401 only means the session ended once we know there was one. Until
			// this runs, the account fetches on the wall and in the route guard are
			// allowed to 401 without ending anything.
			armSessionEnd();
			setupSse(queryClient);
		}
	}, [data, queryClient]);

	useEffect(() => {
		if (data) {
			Sentry.setUser({ id: data.id, username: data.handle });
		}
	}, [data]);

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	if (!data) {
		return (
			<Navigate to="/login" replace search={{ redirect: location.href }} />
		);
	}

	return (
		<>
			<title>Virtool</title>
			<meta charSet="utf-8" />

			<SkipLink />

			<UpdateToast />

			<div className="flex flex-col h-screen">
				<div className="shrink-0 z-nav">
					<Banner />
					<Nav
						administratorRole={data.administratorRole}
						handle={data.handle}
					/>
				</div>

				<div
					id={CONTENT_SCROLL_ID}
					className="flex flex-1 min-h-0 overflow-y-auto scrollbar-gutter-stable"
				>
					<div className="sticky top-0 self-start pt-18">
						<Sidebar administratorRole={data.administratorRole} />
					</div>
					<main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-18">
						<Suspense fallback={<LoadingPlaceholder />}>
							<Outlet />
						</Suspense>
					</main>
				</div>
			</div>

			<Suspense fallback={null}>
				<UploadOverlay />
			</Suspense>
		</>
	);
}
