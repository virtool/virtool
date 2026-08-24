import DeleteDialog from "@base/DeleteDialog";
import IconButton from "@base/IconButton";
import { Trash } from "lucide-react";

type DeleteBannerProps = {
	message: string;
	/** Resolves on success so the dialog can close. */
	onConfirm: () => Promise<unknown>;
};

/**
 * Dialog confirming banner removal. Pure presentation — deletion is delegated
 * to `onConfirm`.
 */
export default function DeleteBanner({
	message,
	onConfirm,
}: DeleteBannerProps) {
	return (
		<DeleteDialog
			name={message}
			noun="Banner"
			onConfirm={onConfirm}
			trigger={<IconButton color="red" IconComponent={Trash} tip="Delete" />}
		/>
	);
}
