import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { Trash } from "lucide-react";

type DeleteLabelProps = {
	name: string;
	/** Resolves on success so the dialog can close. */
	onConfirm: () => Promise<unknown>;
};

/**
 * Dialog confirming label removal. Pure presentation — deletion is delegated
 * to `onConfirm`.
 */
export function DeleteLabel({ name, onConfirm }: DeleteLabelProps) {
	return (
		<DeleteDialog
			name={name}
			noun="Label"
			onConfirm={onConfirm}
			trigger={
				<IconButton IconComponent={Trash} color="red" tip="delete label" />
			}
		/>
	);
}
