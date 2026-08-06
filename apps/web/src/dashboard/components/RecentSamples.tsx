import Link from "@base/Link";
import WorkflowTags from "@samples/components/Tag/WorkflowTags";
import { useSuspenseSamples } from "@samples/queries";
import { FlaskConical } from "lucide-react";
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

type RecentSamplesProps = {
	/** The id of the signed-in user, whose samples are listed. */
	userId: number;
};

/** The signed-in user's most recently created samples. */
export default function RecentSamples({ userId }: RecentSamplesProps) {
	return (
		<DashboardCard
			action={
				<Link search={{ users: [userId] }} to="/samples">
					View all
				</Link>
			}
			title="My samples"
		>
			<DashboardCardBoundary noun="samples">
				<RecentSamplesBody userId={userId} />
			</DashboardCardBoundary>
		</DashboardCard>
	);
}

function RecentSamplesBody({ userId }: RecentSamplesProps) {
	const { data } = useSuspenseSamples(
		1,
		DASHBOARD_ITEM_COUNT,
		"",
		[],
		[],
		[userId],
	);

	if (data.items.length === 0) {
		return (
			<DashboardCardEmpty
				description="Samples you create will appear here."
				icon={FlaskConical}
				title="No samples yet"
			/>
		);
	}

	const remaining = data.foundCount - data.items.length;

	return (
		<DashboardTable labels={["Sample", "Analyses", "Created"]}>
			{data.items.map((sample) => (
				<DashboardTableRow key={sample.id}>
					<DashboardTableCell>
						<Link
							className="font-medium truncate"
							params={{ sampleId: String(sample.id) }}
							to="/samples/$sampleId"
						>
							{sample.name}
						</Link>
					</DashboardTableCell>
					<DashboardTableCell>
						<WorkflowTags id={sample.id} workflows={sample.workflows} />
					</DashboardTableCell>
					<DashboardTableCreatedCell time={sample.createdAt} />
				</DashboardTableRow>
			))}
			{remaining > 0 && (
				<DashboardTableMore>
					<Link search={{ users: [userId] }} to="/samples">
						View {remaining} more {remaining === 1 ? "sample" : "samples"} of
						yours
					</Link>
				</DashboardTableMore>
			)}
		</DashboardTable>
	);
}
