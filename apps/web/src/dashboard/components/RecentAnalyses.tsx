import { useSuspenseRecentAnalyses } from "@analyses/queries";
import { checkSupportedWorkflow } from "@analyses/utils";
import { getWorkflowDisplayName } from "@app/utils";
import Link from "@base/Link";
import { ChartArea } from "lucide-react";
import { DASHBOARD_ITEM_COUNT } from "../constants";
import DashboardCard, {
	DashboardCardBoundary,
	DashboardCardEmpty,
} from "./DashboardCard";
import DashboardTable, {
	DashboardTableCell,
	DashboardTableCreatedCell,
	DashboardTableMore,
	DashboardTableRow,
} from "./DashboardTable";

type RecentAnalysesProps = {
	/** The id of the signed-in user, whose analyses are listed. */
	userId: number;
};

/**
 * The signed-in user's most recently started analyses, across every sample.
 *
 * There is no card action: analyses have no global list page to link to, so
 * each row links to the analysis itself.
 */
export default function RecentAnalyses({ userId }: RecentAnalysesProps) {
	return (
		<DashboardCard title="My analyses">
			<DashboardCardBoundary noun="analyses">
				<RecentAnalysesBody userId={userId} />
			</DashboardCardBoundary>
		</DashboardCard>
	);
}

function RecentAnalysesBody({ userId }: RecentAnalysesProps) {
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

	const remaining = data.foundCount - data.items.length;

	return (
		<DashboardTable labels={["Workflow", "Sample", "Created"]}>
			{data.items.map((analysis) => (
				<DashboardTableRow key={analysis.id}>
					<DashboardTableCell>
						{checkSupportedWorkflow(analysis.workflow) ? (
							<Link
								className="font-medium truncate"
								params={{
									analysisId: String(analysis.id),
									sampleId: String(analysis.sample.id),
								}}
								to="/samples/$sampleId/analyses/$analysisId"
							>
								{getWorkflowDisplayName(analysis.workflow)}
							</Link>
						) : (
							<span className="font-medium truncate">
								{getWorkflowDisplayName(analysis.workflow)}
							</span>
						)}
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
					<DashboardTableCreatedCell time={analysis.createdAt} />
				</DashboardTableRow>
			))}
			{remaining > 0 && (
				<DashboardTableMore>
					{remaining} more {remaining === 1 ? "analysis is" : "analyses are"}{" "}
					not shown
				</DashboardTableMore>
			)}
		</DashboardTable>
	);
}
