import DeleteDialog from "@base/DeleteDialog";
import { IconButton } from "@base/Icon";
import { useDeleteSubtraction } from "@subtraction/queries";
import { useNavigate } from "@tanstack/react-router";
import type { Subtraction } from "@virtool/contracts";
import { Trash } from "lucide-react";

export type DeleteSubtractionProps = {
	/** The subtraction data */
	subtraction: Subtraction;
};

/**
 * Dialog for deleting an existing subtraction
 */
export default function DeleteSubtraction({
	subtraction,
}: DeleteSubtractionProps) {
	const mutation = useDeleteSubtraction();
	const navigate = useNavigate();

	async function handleConfirm() {
		await mutation.mutateAsync({ subtractionId: subtraction.id });
		navigate({ to: "/subtractions" });
	}

	return (
		<DeleteDialog
			name={subtraction.name}
			noun="Subtraction"
			onConfirm={handleConfirm}
			trigger={<IconButton IconComponent={Trash} color="red" tip="Delete" />}
		/>
	);
}
