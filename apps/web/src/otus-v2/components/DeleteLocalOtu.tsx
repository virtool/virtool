import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { useDeleteLocalOtu } from "@otus-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import type { LocalOtuV2Overview } from "@virtool/contracts";
import { Trash } from "lucide-react";

/** Confirmation control for deleting a local v2 OTU. */
export default function DeleteLocalOtu({ otu }: { otu: LocalOtuV2Overview }) {
	const mutation = useDeleteLocalOtu(otu.referenceId);
	const navigate = useNavigate();

	async function handleConfirm() {
		await mutation.mutateAsync({
			type: "DeleteOTU",
			schemaVersion: 1,
			otuId: otu.id,
			expectedVersion: otu.version,
			payload: {},
		});
		await navigate({
			to: "/refs/alpha/$referenceId/otus",
			params: { referenceId: otu.referenceId },
		});
	}

	return (
		<DeleteDialog
			name={otu.taxonomy.name}
			noun="OTU"
			onConfirm={handleConfirm}
			trigger={<IconButton IconComponent={Trash} color="red" tip="Delete" />}
		/>
	);
}
