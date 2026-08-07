import { useCheckAdminRole } from "@administration/hooks";
import { getWorkflowDisplayName } from "@app/utils";
import Attribution from "@base/Attribution";
import Box from "@base/Box";
import Icon from "@base/Icon";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import SlashList from "@base/SlashList";
import { useFetchJob } from "@jobs/queries";
import { type AnalysisMinimal, isJobStateTerminal } from "@virtool/contracts";
import { Equal, EqualNot } from "lucide-react";
import { useRemoveAnalysis } from "../queries";
import { checkSupportedWorkflow } from "../utils";
import { AnalysisItemRightIcon } from "./AnalysisItemRightIcon";

type AnalysisItemProps = {
	analysis: AnalysisMinimal;
};

/**
 * Condensed analysis item for use in a list of analyses
 */
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
	const onRemove = useRemoveAnalysis(id);

	const title = checkSupportedWorkflow(workflow) ? (
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
		<div className="text-black [&_svg]:ml-1">
			{getWorkflowDisplayName(workflow)}
			<span className="text-gray-500 text-sm ml-1 font-normal">
				Workflow unavailable
			</span>
		</div>
	);

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
		<Box as="li" className="text-gray-600 mb-2.5">
			<div className="grid grid-cols-5 items-center text-base font-medium [&_a]:font-medium">
				<div className="col-span-2">{title}</div>
				<Attribution
					className="col-span-2 text-sm font-normal"
					user={user.handle}
					time={createdAt}
				/>
				<div className="flex justify-end items-center gap-2">
					{!ready && (
						<ProgressCircle
							progress={job?.progress ?? 0}
							state={job?.state ?? "pending"}
						/>
					)}
					{canDelete && (
						<AnalysisItemRightIcon
							canModify={canModify ?? false}
							onRemove={onRemove}
						/>
					)}
				</div>
			</div>
			<div className="flex items-center mt-2.5">
				<span
					className="inline-flex items-center mr-4 [&_i]:mr-1"
					key="reference"
				>
					<Equal size={18} />
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
				</span>
				{subtractions.map((subtraction) => (
					<span
						className="inline-flex items-center mr-4 [&_i]:mr-1"
						key={subtraction.id}
					>
						<Icon icon={EqualNot} />
						<Link
							to="/subtractions/$subtractionId"
							params={{ subtractionId: String(subtraction.id) }}
						>
							{subtraction.name}
						</Link>
					</span>
				))}
			</div>
		</Box>
	);
}
