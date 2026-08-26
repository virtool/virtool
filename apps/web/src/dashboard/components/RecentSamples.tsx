import Link from "@base/Link";
import WorkflowTags from "@samples/components/WorkflowTags";
import {
	useSuspenseRecentlyViewedSamples,
	useSuspenseSamples,
} from "@samples/queries";
import type { SampleMinimal } from "@virtool/contracts";
import { FlaskConical } from "lucide-react";
import { type ReactNode, Suspense, useState } from "react";
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
} from "./DashboardTable";
import RecentModeToggle, { type RecentMode } from "./RecentModeToggle";

type RecentSamplesProps = {
	/** The id of the signed-in user, whose created samples the "created" tab lists. */
	userId: number;
};

/**
 * The signed-in user's samples — most recently viewed by default, or most
 * recently created, chosen by the header toggle.
 *
 * The two tabs draw from different queries, so each has its own body component
 * rather than one that switches hooks. A local `Suspense` keeps a tab switch's
 * loading state inside the card.
 */
export default function RecentSamples({ userId }: RecentSamplesProps) {
	const [mode, setMode] = useState<RecentMode>("viewed");

	return (
		<DashboardCard
			action={
				<RecentModeToggle
					aria-label="Which samples to show"
					mode={mode}
					onChange={setMode}
				/>
			}
			title="Samples"
		>
			<DashboardCardBoundary noun="samples">
				<Suspense fallback={<DashboardCardLoading />}>
					{mode === "viewed" ? (
						<ViewedSamplesBody />
					) : (
						<CreatedSamplesBody userId={userId} />
					)}
				</Suspense>
			</DashboardCardBoundary>
		</DashboardCard>
	);
}

function ViewedSamplesBody() {
	const { data } = useSuspenseRecentlyViewedSamples(DASHBOARD_ITEM_COUNT);

	if (data.items.length === 0) {
		return (
			<DashboardCardEmpty
				description="Samples you open will appear here."
				icon={FlaskConical}
				title="No samples viewed yet"
			/>
		);
	}

	const remaining = data.foundCount - data.items.length;

	return (
		<SamplesTable samples={data.items}>
			{remaining > 0 && (
				<DashboardTableMore>
					{remaining} more {remaining === 1 ? "sample is" : "samples are"} not
					shown
				</DashboardTableMore>
			)}
		</SamplesTable>
	);
}

function CreatedSamplesBody({ userId }: RecentSamplesProps) {
	const { data } = useSuspenseSamples({
		page: 1,
		perPage: DASHBOARD_ITEM_COUNT,
		users: [userId],
	});

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
		<SamplesTable samples={data.items}>
			{remaining > 0 && (
				<DashboardTableMore>
					<Link search={{ users: [userId] }} to="/samples">
						View {remaining} more {remaining === 1 ? "sample" : "samples"} of
						yours
					</Link>
				</DashboardTableMore>
			)}
		</SamplesTable>
	);
}

type SamplesTableProps = {
	/** An optional `DashboardTableMore` footer row. */
	children?: ReactNode;

	/** The samples to list, already ordered. */
	samples: SampleMinimal[];
};

function SamplesTable({ children, samples }: SamplesTableProps) {
	return (
		<DashboardTable labels={["Sample", "Analyses", "Created"]}>
			{samples.map((sample) => (
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
			{children}
		</DashboardTable>
	);
}
