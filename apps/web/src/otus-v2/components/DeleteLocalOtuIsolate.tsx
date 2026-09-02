import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { useDeleteLocalOtuIsolate } from "@otus-v2/queries";
import type { LocalOtuV2IsolateSummary } from "@virtool/contracts";
import { Trash } from "lucide-react";

type DeleteLocalOtuIsolateProps = {
	referenceId: string;
	otuId: string;
	version: number;
	isolate: Pick<LocalOtuV2IsolateSummary, "id" | "name">;
	onDeleted?: () => Promise<void> | void;
};

/** Confirmation control for deleting a local v2 isolate. */
export default function DeleteLocalOtuIsolate({
	referenceId,
	otuId,
	version,
	isolate,
	onDeleted,
}: DeleteLocalOtuIsolateProps) {
	const mutation = useDeleteLocalOtuIsolate(referenceId);
	const name = isolate.name
		? `${isolate.name.type} ${isolate.name.value}`
		: "Unnamed isolate";

	async function handleConfirm() {
		await mutation.mutateAsync({
			type: "DeleteIsolate",
			schemaVersion: 1,
			otuId,
			expectedVersion: version,
			payload: { isolateId: isolate.id },
		});
		await onDeleted?.();
	}

	return (
		<DeleteDialog
			name={name}
			noun="isolate"
			onConfirm={handleConfirm}
			trigger={
				<IconButton IconComponent={Trash} color="red" tip="Delete isolate" />
			}
		/>
	);
}
