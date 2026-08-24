import { useSuspenseAccount } from "@account/account";
import { ContainerNarrow } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import ActiveJobs from "./ActiveJobs";
import RecentAnalyses from "./RecentAnalyses";
import RecentSamples from "./RecentSamples";

/**
 * The landing page at `/`.
 *
 * Every card suspends, so the route's `Suspense` covers the whole page with one
 * placeholder and the cards appear together rather than popping in one at a
 * time. A card that fails still fails alone — see `DashboardCardBoundary`.
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
