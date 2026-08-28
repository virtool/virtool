import { useSuspenseAccount } from "@account/account";
import { ContainerNarrow } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import RecentAnalyses from "./RecentAnalyses";
import type { RecentMode } from "./RecentModeToggle";
import RecentSamples from "./RecentSamples";

type DashboardProps = {
	/** Which set the analyses card lists. */
	analysesMode: RecentMode;

	/** Switches the analyses card between viewed and created. */
	onAnalysesModeChange: (mode: RecentMode) => void;

	/** Switches the samples card between viewed and created. */
	onSamplesModeChange: (mode: RecentMode) => void;

	/** Which set the samples card lists. */
	samplesMode: RecentMode;
};

/**
 * The landing page at `/`.
 *
 * The account read suspends the whole page for the first paint. Beyond that,
 * the "recently" cards own a `Suspense` apiece so a viewed/created toggle
 * reloads only its own card. A card that fails still fails alone — see
 * `DashboardCardBoundary`.
 */
export default function Dashboard({
	analysesMode,
	onAnalysesModeChange,
	onSamplesModeChange,
	samplesMode,
}: DashboardProps) {
	const { data: account } = useSuspenseAccount();

	return (
		<ContainerNarrow>
			<ViewHeader title="Dashboard">
				<ViewHeaderTitle>Dashboard</ViewHeaderTitle>
			</ViewHeader>

			<div className="flex flex-col gap-8">
				<RecentSamples
					mode={samplesMode}
					onModeChange={onSamplesModeChange}
					userId={account.id}
				/>
				<RecentAnalyses
					mode={analysesMode}
					onModeChange={onAnalysesModeChange}
					userId={account.id}
				/>
			</div>
		</ContainerNarrow>
	);
}
