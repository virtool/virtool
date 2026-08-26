import { useSuspenseAccount } from "@account/account";
import { ContainerNarrow } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import ActiveJobs from "./ActiveJobs";
import RecentAnalyses from "./RecentAnalyses";
import RecentSamples from "./RecentSamples";

/**
 * The landing page at `/`.
 *
 * The account read suspends the whole page for the first paint. Beyond that,
 * the "recently" cards own a `Suspense` apiece so a viewed/created toggle
 * reloads only its own card; `ActiveJobs` still leans on the enclosing one. A
 * card that fails still fails alone — see `DashboardCardBoundary`.
 */
export default function Dashboard() {
	const { data: account } = useSuspenseAccount();

	return (
		<ContainerNarrow>
			<ViewHeader title="Dashboard">
				<ViewHeaderTitle>Dashboard</ViewHeaderTitle>
			</ViewHeader>

			<div className="flex flex-col gap-8">
				<RecentSamples userId={account.id} />
				<RecentAnalyses userId={account.id} />
				<ActiveJobs />
			</div>
		</ContainerNarrow>
	);
}
