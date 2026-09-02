import Box from "@base/Box";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import DeleteReferenceV2 from "./DeleteReferenceV2";

/** Settings and destructive actions for a local v2 Reference. */
export default function ReferenceV2Settings({
	referenceId,
}: {
	referenceId: string;
}) {
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<section aria-labelledby="danger-zone-heading">
			<h3 id="danger-zone-heading" className="mb-3">
				Danger zone
			</h3>
			<Box className="flex items-center justify-between border-red-200">
				<div>
					<h4 className="font-semibold">Delete this reference</h4>
					<p className="text-gray-600">
						Permanently delete the reference and all of its OTU data.
					</p>
				</div>
				<DeleteReferenceV2 reference={reference} />
			</Box>
		</section>
	);
}
