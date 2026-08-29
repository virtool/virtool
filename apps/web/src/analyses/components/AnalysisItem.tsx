import { useCheckAdminRole } from "@administration/hooks";
import { getWorkflowDisplayName } from "@app/utils";
import { IconButton } from "@base/Icon";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import RelativeTime from "@base/RelativeTime";
import SlashList from "@base/SlashList";
import { TableActionsCell } from "@base/Table";
import UserLabel from "@base/UserLabel";
import { useFetchJob } from "@jobs/queries";
import { type AnalysisMinimal, isJobStateTerminal } from "@virtool/contracts";
import { Trash } from "lucide-react";
import { useDeleteAnalysis } from "../queries";
import { checkSupportedWorkflow, getWorkflowVersionLabel } from "../utils";

type AnalysisItemProps = {
	analysis: AnalysisMinimal;
};

/** One analysis in the table of a sample's analyses. */
export default function AnalysisItem({ analysis }: AnalysisItemProps) {
	const {
		id,
		workflow,
		ready,
		user,
		reference,
		index,
		subtractions,
		createdAt,
	} = analysis;
	const { hasPermission: canModify } = useCheckAdminRole("users");
	const onDelete = useDeleteAnalysis(id);

	const { data: job } = useFetchJob(
		analysis.job?.id ?? Number.NaN,
		analysis.job ?? undefined,
	);

	// The same predicate `deleteAnalysis` applies, and deliberately not `ready`.
	// It reads both ways: an unready analysis whose pod was OOM-killed or evicted
	// stays removable rather than stranding the user, and a finished analysis
	// whose job has not been marked terminal yet does not advertise a button the
	// server would answer with a 409.
	const state = job?.state ?? analysis.job?.state;
	const canDelete = state === undefined || isJobStateTerminal(state);

	return (
		<tr>
			<td className="font-medium">
				{checkSupportedWorkflow(workflow) ? (
					<Link
						to="/samples/$sampleId/analyses/$analysisId"
						params={{
							sampleId: String(analysis.sample.id),
							analysisId: String(id),
						}}
					>
						{getWorkflowDisplayName(workflow)}
					</Link>
				) : (
					<>
						{getWorkflowDisplayName(workflow)}
						<span className="block text-gray-500 text-sm font-normal">
							Workflow unavailable
						</span>
					</>
				)}
			</td>
			<td className="text-gray-600 text-sm">
				{getWorkflowVersionLabel(analysis.workflowVersion)}
			</td>
			<td>
				<SlashList className="m-0">
					<li>
						<Link to="/refs/$refId" params={{ refId: String(reference.id) }}>
							{reference.name}
						</Link>
					</li>
					<li>
						<Link
							to="/refs/$refId/indexes/$indexId"
							params={{
								refId: String(reference.id),
								indexId: String(index.id),
							}}
						>
							Index {index.version}
						</Link>
					</li>
				</SlashList>
			</td>
			<td>
				{subtractions.map((subtraction, subtractionIndex) => (
					<span key={subtraction.id}>
						{subtractionIndex > 0 && ", "}
						<Link
							to="/subtractions/$subtractionId"
							params={{ subtractionId: String(subtraction.id) }}
						>
							{subtraction.name}
						</Link>
					</span>
				))}
			</td>
			<td>
				<UserLabel handle={user.handle} />
			</td>
			<td className="whitespace-nowrap">
				<RelativeTime time={createdAt} />
			</td>
			<TableActionsCell>
				{!ready && (
					<span className="flex size-10 items-center justify-center">
						<ProgressCircle
							progress={job?.progress ?? 0}
							state={job?.state ?? "pending"}
						/>
					</span>
				)}
				{canDelete && canModify && (
					<IconButton
						IconComponent={Trash}
						color="red"
						tip="Delete"
						onClick={onDelete}
					/>
				)}
			</TableActionsCell>
		</tr>
	);
}
