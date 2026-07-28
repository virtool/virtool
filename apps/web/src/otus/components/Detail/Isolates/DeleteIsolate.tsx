import DeleteDialog from "@base/DeleteDialog";
import { useDeleteIsolate } from "@otus/queries";

type DeleteIsolateProps = {
	/** The id of the isolate being deleted */
	id: string;
	/** The name of the isolate being deleted */
	name: string;
	/** A callback function to hide the dialog */
	onHide: () => void;
	/** The id of the otu in which the isolate belongs to */
	otuId: string;
	/** Whether the dialog to delete the isolate is visible */
	show: boolean;
};

/**
 * Displays a dialog for deleting an OTU isolate
 */
export default function DeleteIsolate({
	id,
	name,
	onHide,
	otuId,
	show,
}: DeleteIsolateProps) {
	const mutation = useDeleteIsolate();

	return (
		<DeleteDialog
			name={name}
			noun="Isolate"
			onConfirm={() => mutation.mutateAsync({ otuId, isolateId: id })}
			onOpenChange={onHide}
			open={show}
		/>
	);
}
