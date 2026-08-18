import { useCheckAdminRole } from "@administration/hooks";
import { useGetAnalysis, useRemoveAnalysis } from "@analyses/queries";
import { getWorkflowDisplayName } from "@app/utils";
import Attribution from "@base/Attribution";
import Box from "@base/Box";
import Icon from "@base/Icon";
import IconButton from "@base/IconButton";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SlashList from "@base/SlashList";
import { Equal, EqualNot, Trash } from "lucide-react";

type AnalysisPeekProps = {
	/** The unique identifier of the analysis the job is producing */
	analysisId: number;
};

/**
 * The analysis a Pathoscope or NuVs job produces, shown on the job detail view.
 *
 * Apart from `AnalysisItem`, which it is otherwise shaped like, it shows no job
 * state — the job's own state and steps are on the same page — and offers
 * removal only while the analysis is unfinished, where a stuck or failed run is
 * worth clearing out.
 */
export default function AnalysisPeek({ analysisId }: AnalysisPeekProps) {
	const { data, isPending, isError } = useGetAnalysis(analysisId);
	const { hasPermission: canModify } = useCheckAdminRole("users");
	const onRemove = useRemoveAnalysis(analysisId);

	if (isError && !data) {
		return <QueryError noun="analysis" />;
	}

	if (isPending) {
		return <LoadingPlaceholder className="mt-8 mb-8" />;
	}

	const {
		createdAt,
		index,
		ready,
		reference,
		sample,
		subtractions,
		user,
		workflow,
	} = data;

	return (
		<Box className="text-gray-600 mb-2.5">
			<div className="grid grid-cols-5 items-center text-base font-medium [&_a]:font-medium">
				<div className="col-span-2">
					<Link
						to="/samples/$sampleId/analyses/$analysisId"
						params={{
							sampleId: String(sample.id),
							analysisId: String(analysisId),
						}}
					>
						{getWorkflowDisplayName(workflow)}
					</Link>
				</div>
				<Attribution
					className="col-span-2 text-sm font-normal"
					user={user.handle}
					time={createdAt}
				/>
				<div className="flex justify-end items-center gap-2">
					{!ready && canModify && (
						<IconButton
							IconComponent={Trash}
							color="red"
							tip="remove"
							onClick={onRemove}
						/>
					)}
				</div>
			</div>
			<div className="flex items-center mt-2.5">
				<span className="inline-flex items-center mr-4 [&_i]:mr-1">
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
