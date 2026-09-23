import { getErrorStatus } from "@app/queryErrors";
import Button from "@base/Button";
import CreateLocalOtuDialog from "@otus-v2/components/CreateLocalOtuDialog";
import LocalOtuV2List from "@otus-v2/components/LocalOtuV2List";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute(
	"/_authenticated/refs/alpha/$referenceId/otus/",
)({
	loader: async ({ context: { queryClient }, params: { referenceId } }) => {
		const { localOtusV2QueryOptions } = await import("@otus-v2/queries");

		try {
			await queryClient.ensureQueryData(localOtusV2QueryOptions(referenceId));
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: LocalOtusRoute,
});

function LocalOtusRoute() {
	const { referenceId } = Route.useParams();
	const { data: reference } = useSuspenseReferenceV2(referenceId);
	const canModifyOtus = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);

	return (
		<div>
			{canModifyOtus && (
				<CreateLocalOtuDialog
					open={open}
					setOpen={setOpen}
					referenceId={referenceId}
					defaultSegmentLengthTolerance={
						reference.defaultSegmentLengthTolerance
					}
				/>
			)}

			<LocalOtuV2List
				referenceId={referenceId}
				toolbar={
					canModifyOtus && (
						<Button color="blue" onClick={() => setOpen(true)}>
							Create
						</Button>
					)
				}
			/>
		</div>
	);
}
