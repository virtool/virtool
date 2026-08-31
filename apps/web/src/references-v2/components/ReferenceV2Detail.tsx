import Box from "@base/Box";
import { useSuspenseReferenceV2 } from "@references-v2/queries";

/** The general information for a local v2 Reference. */
export default function ReferenceV2Detail({
	referenceId,
}: {
	referenceId: string;
}) {
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<Box>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
				<dt className="font-semibold">Kind</dt>
				<dd>{reference.kind}</dd>
				<dt className="font-semibold">Default length tolerance</dt>
				<dd>{reference.defaultSegmentLengthTolerance}</dd>
				<dt className="font-semibold">Archived</dt>
				<dd>{reference.archived ? "Yes" : "No"}</dd>
			</dl>
		</Box>
	);
}
