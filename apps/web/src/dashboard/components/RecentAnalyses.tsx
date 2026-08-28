import {
	useSuspenseRecentAnalyses,
	useSuspenseRecentlyViewedAnalyses,
} from "@analyses/queries";
import {
	checkSupportedWorkflow,
	getWorkflowVersionLabel,
} from "@analyses/utils";
import { getWorkflowDisplayName } from "@app/utils";
import Link from "@base/Link";
import type { AnalysisMinimal } from "@virtool/contracts";
import { ChartArea } from "lucide-react";
import { Suspense } from "react";
import { DASHBOARD_ITEM_COUNT } from "../constants";
import DashboardCard, {
	DashboardCardBoundary,
	DashboardCardEmpty,
	DashboardCardLoading,
} from "./DashboardCard";
import DashboardTable, {
	DashboardTableCell,
	DashboardTableCreatedCell,
	DashboardTableMore,
	DashboardTableRow,
	DashboardTableUserCell,
} from "./DashboardTable";
import RecentModeToggle, { type RecentMode } from "./RecentModeToggle";

type RecentAnalysesProps = {
	/** Which set to list: what the user viewed or created. */
	mode: RecentMode;

	/** Switches between the viewed and created sets. */
	onModeChange: (mode: RecentMode) => void;

	/** The id of the signed-in user, whose started analyses the "created" tab lists. */
	userId: number;
};

/**
 * The signed-in user's analyses, across every sample — most recently viewed by
 * default, or most recently started, chosen by the header toggle.
 *
 * Each row links to the analysis itself; there is no global analyses list to
 * offer a "view all" for.
 */
export default function RecentAnalyses({
	mode,
	onModeChange,
	userId,
}: RecentAnalysesProps) {
	return (
		<DashboardCard
			action={
				<RecentModeToggle
					aria-label="Which analyses to show"
					mode={mode}
					onChange={onModeChange}
				/>
			}
			title="Recent Analyses"
		>
			<DashboardCardBoundary noun="analyses">
				<Suspense fallback={<DashboardCardLoading />}>
					{mode === "viewed" ? (
						<ViewedAnalysesBody />
					) : (
						<CreatedAnalysesBody userId={userId} />
					)}
				</Suspense>
			</DashboardCardBoundary>
		</DashboardCard>
	);
}

function ViewedAnalysesBody() {
	const { data } = useSuspenseRecentlyViewedAnalyses(DASHBOARD_ITEM_COUNT);

	if (data.items.length === 0) {
		return (
			<DashboardCardEmpty
				description="Analyses you open will appear here."
				icon={ChartArea}
				title="No analyses viewed yet"
			/>
		);
	}

	return <AnalysesTable analyses={data.items} remaining={data.foundCount} />;
}

function CreatedAnalysesBody({ userId }: { userId: number }) {
	const { data } = useSuspenseRecentAnalyses(userId, DASHBOARD_ITEM_COUNT);

	if (data.items.length === 0) {
		return (
			<DashboardCardEmpty
				description="Analyses you start will appear here."
				icon={ChartArea}
				title="No analyses yet"
			/>
		);
	}

	return <AnalysesTable analyses={data.items} remaining={data.foundCount} />;
}

type AnalysesTableProps = {
	/** The analyses to list, already ordered. */
	analyses: AnalysisMinimal[];

	/** The total found, for the "N more not shown" footer. */
	remaining: number;
};

function AnalysesTable({ analyses, remaining }: AnalysesTableProps) {
	const hidden = remaining - analyses.length;

	return (
		<DashboardTable
			labels={["Workflow", "Version", "Sample", "User", "Created"]}
		>
			{analyses.map((analysis) => (
				<DashboardTableRow key={analysis.id}>
					<DashboardTableCell>
						{checkSupportedWorkflow(analysis.workflow) ? (
							<Link
								className="text-lg font-medium truncate"
								params={{
									analysisId: String(analysis.id),
									sampleId: String(analysis.sample.id),
								}}
								to="/samples/$sampleId/analyses/$analysisId"
							>
								{getWorkflowDisplayName(analysis.workflow)}
							</Link>
						) : (
							<span className="text-lg font-medium truncate">
								{getWorkflowDisplayName(analysis.workflow)}
							</span>
						)}
					</DashboardTableCell>
					<DashboardTableCell>
						<span className="text-gray-600 text-sm truncate">
							{getWorkflowVersionLabel(analysis.workflowVersion)}
						</span>
					</DashboardTableCell>
					<DashboardTableCell>
						<Link
							className="truncate"
							params={{ sampleId: String(analysis.sample.id) }}
							to="/samples/$sampleId"
						>
							{analysis.sample.name}
						</Link>
					</DashboardTableCell>
					<DashboardTableUserCell handle={analysis.user.handle} />
					<DashboardTableCreatedCell time={analysis.createdAt} />
				</DashboardTableRow>
			))}
			{hidden > 0 && (
				<DashboardTableMore>
					{hidden} more {hidden === 1 ? "analysis is" : "analyses are"} not
					shown
				</DashboardTableMore>
			)}
		</DashboardTable>
	);
}
