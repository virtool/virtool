import Attribution from "@base/Attribution";
import Box from "@base/Box";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { useFetchSample } from "@samples/queries";

type SamplePeekProps = {
	/** The unique identifier of the sample the job is producing */
	sampleId: number;
};

/**
 * The sample a create_sample job produces, shown on the job detail view.
 *
 * Like `AnalysisPeek`, it shows no job state and no controls — the job's own
 * state, steps and progress are on the same page, so repeating any of them here
 * would be a second opinion about the same run.
 */
export default function SamplePeek({ sampleId }: SamplePeekProps) {
	const { data, isPending, isError } = useFetchSample(sampleId);

	if (isError && !data) {
		return <QueryError noun="sample" />;
	}

	if (isPending) {
		return <LoadingPlaceholder className="mt-8 mb-8" />;
	}

	const { createdAt, name, user } = data;

	return (
		<Box className="mb-2.5">
			<div className="grid grid-cols-5 items-center text-base font-medium [&_a]:font-medium">
				<div className="col-span-2">
					<Link
						className="text-lg"
						to="/samples/$sampleId"
						params={{ sampleId: String(sampleId) }}
					>
						{name}
					</Link>
				</div>
				<Attribution
					className="col-span-2 font-normal"
					user={user.handle}
					time={createdAt}
				/>
			</div>
		</Box>
	);
}
