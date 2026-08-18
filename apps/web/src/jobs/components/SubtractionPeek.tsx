import Box from "@base/Box";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { SubtractionAttribution } from "@subtraction/components/Attribution";
import { useFetchSubtraction } from "@subtraction/queries";

type SubtractionPeekProps = {
	/** The unique identifier of the subtraction the job is producing */
	subtractionId: number;
};

/**
 * The subtraction a create_subtraction job produces, shown on the job detail
 * view.
 *
 * Like `AnalysisPeek`, it shows no job state and no controls — the job's own
 * state, steps and progress are on the same page, so repeating any of them here
 * would be a second opinion about the same run.
 */
export default function SubtractionPeek({
	subtractionId,
}: SubtractionPeekProps) {
	const { data, isPending, isError } = useFetchSubtraction(subtractionId);

	if (isError && !data) {
		return <QueryError noun="subtraction" />;
	}

	if (isPending) {
		return <LoadingPlaceholder className="mt-8 mb-8" />;
	}

	const { createdAt, name, nickname, user } = data;

	return (
		<Box className="mb-2.5">
			<div className="grid grid-cols-5 items-center text-base font-medium [&_a]:font-medium">
				<div className="col-span-2">
					<Link
						className="text-lg"
						to="/subtractions/$subtractionId"
						params={{ subtractionId: String(subtractionId) }}
					>
						{name}
					</Link>
					{nickname && (
						<span className="ml-2 font-normal text-gray-500">{nickname}</span>
					)}
				</div>
				<div className="col-span-2 font-normal">
					<SubtractionAttribution
						handle={user?.handle ?? ""}
						time={createdAt}
					/>
				</div>
			</div>
		</Box>
	);
}
