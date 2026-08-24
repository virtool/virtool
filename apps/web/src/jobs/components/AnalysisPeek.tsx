import { useGetAnalysis } from "@analyses/queries";
import { getWorkflowDisplayName } from "@app/utils";
import Attribution from "@base/Attribution";
import Box from "@base/Box";
import Icon from "@base/Icon";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SlashList from "@base/SlashList";
import { Equal, EqualNot } from "lucide-react";

type AnalysisPeekProps = {
	/** The unique identifier of the analysis the job is producing */
	analysisId: number;
};

/**
 * The analysis a Pathoscope or NuVs job produces, shown on the job detail view.
 *
 * Apart from `AnalysisItem`, which it is otherwise shaped like, it shows no job
 * state and no delete button — the job's own state, steps and controls are on
 * the same page, so repeating any of them here would be a second opinion about
 * the same run.
 */
export default function AnalysisPeek({ analysisId }: AnalysisPeekProps) {
	const { data, isPending, isError } = useGetAnalysis(analysisId);

	if (isError && !data) {
		return <QueryError noun="analysis" />;
	}

	if (isPending) {
		return <LoadingPlaceholder className="mt-8 mb-8" />;
	}

	const { createdAt, index, reference, sample, subtractions, user, workflow } =
		data;

	return (
		<Box className="mb-2.5">
			<div className="grid grid-cols-5 items-center text-base font-medium [&_a]:font-medium">
				<div className="col-span-2">
					<Link
						className="text-lg"
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
					className="col-span-2 font-normal"
					user={user.handle}
					time={createdAt}
				/>
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
