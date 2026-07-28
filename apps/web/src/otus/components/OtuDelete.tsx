import DeleteDialog from "@base/DeleteDialog";
import { useDeleteOtu } from "../queries";

type OtuDeleteProps = {
	id: string;
	name: string;
	open?: boolean;
	onDeleted: () => void;
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for deleting an OTU
 */
export default function OtuDelete({
	id,
	name,
	open = false,
	onDeleted,
	setOpen = () => {},
}: OtuDeleteProps) {
	const mutation = useDeleteOtu();

	async function handleConfirm() {
		await mutation.mutateAsync({ otuId: id });
		onDeleted();
	}

	return (
		<DeleteDialog
			name={name}
			noun="OTU"
			onConfirm={handleConfirm}
			onOpenChange={setOpen}
			open={open}
		/>
	);
}
