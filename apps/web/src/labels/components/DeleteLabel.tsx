import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { Trash } from "lucide-react";

type DeleteLabelProps = {
	name: string;
	/** The number of samples carrying the label. */
	sampleCount: number;
	/** Resolves on success so the dialog can close. */
	onConfirm: () => Promise<unknown>;
};

/**
 * Dialog confirming label deletion. Pure presentation — deletion is delegated
 * to `onConfirm`.
 */
export function DeleteLabel({
	name,
	sampleCount,
	onConfirm,
}: DeleteLabelProps) {
	return (
		<DeleteDialog
			name={name}
			noun="Label"
			message={
				<>
					Are you sure you want to delete <strong>{name}</strong>?
					{sampleCount > 0 &&
						` It will be removed from ${sampleCount} ${sampleCount === 1 ? "sample" : "samples"}.`}
				</>
			}
			onConfirm={onConfirm}
			trigger={<IconButton IconComponent={Trash} color="red" tip="Delete" />}
		/>
	);
}
