import Box from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import ArchiveReferenceV2 from "./ArchiveReferenceV2";
import DeleteReferenceV2 from "./DeleteReferenceV2";
import ReferenceV2Members from "./ReferenceV2Members";

/** Settings and destructive actions for a local v2 Reference. */
export default function ReferenceV2Settings({
	referenceId,
}: {
	referenceId: string;
}) {
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<>
			<ReferenceV2Members
				members={reference.users}
				noun="user"
				referenceId={referenceId}
			/>
			<ReferenceV2Members
				members={reference.groups}
				noun="group"
				referenceId={referenceId}
			/>
			<section aria-labelledby="danger-zone-heading">
				<SectionHeader>
					<h2 id="danger-zone-heading">Danger zone</h2>
				</SectionHeader>
				<Box className="mb-0 flex items-center justify-between rounded-b-none border-red-200">
					<div>
						<h4 className="font-semibold">
							{reference.archived
								? "Unarchive this reference"
								: "Archive this reference"}
						</h4>
						<p className="text-gray-600">
							{reference.archived
								? "Return the reference to active use and allow modifications."
								: "Make the reference read-only without deleting its data."}
						</p>
					</div>
					<ArchiveReferenceV2 reference={reference} />
				</Box>
				<Box className="flex items-center justify-between rounded-t-none border-t-0 border-red-200">
					<div>
						<h4 className="font-semibold">Delete this reference</h4>
						<p className="text-gray-600">
							Permanently delete the reference and all of its OTU data.
						</p>
					</div>
					<DeleteReferenceV2 reference={reference} />
				</Box>
			</section>
		</>
	);
}
