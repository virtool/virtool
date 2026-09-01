import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { useDeleteReferenceV2 } from "@references-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import type { ReferenceV2 } from "@virtool/contracts";
import { Trash } from "lucide-react";

/** Confirmation dialog for permanently deleting a v2 Reference. */
export default function DeleteReferenceV2({
	reference,
}: {
	reference: ReferenceV2;
}) {
	const mutation = useDeleteReferenceV2();
	const navigate = useNavigate();

	async function handleConfirm() {
		await mutation.mutateAsync(reference.id);
		await navigate({ to: "/refs/alpha" });
	}

	return (
		<DeleteDialog
			name={reference.name}
			noun="Reference"
			onConfirm={handleConfirm}
			trigger={<IconButton IconComponent={Trash} color="red" tip="Delete" />}
		/>
	);
}
