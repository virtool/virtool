import Alert from "@base/Alert";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import { useNavigate } from "@tanstack/react-router";
import { useDeletePendingUser } from "@users/queries";
import { useState } from "react";

type DeletePendingUserProps = {
	userId: number;
	/** The invited email address, when the invitation has loaded */
	email?: string;
};

/** A danger-zone control that deletes a user who has not accepted their invitation. */
export function DeletePendingUser({ userId, email }: DeletePendingUserProps) {
	const [open, setOpen] = useState(false);
	const mutation = useDeletePendingUser();
	const navigate = useNavigate();

	async function handleConfirm() {
		await mutation.mutateAsync(userId);
		await navigate({ to: "/administration/users" });
	}

	return (
		<>
			<Alert className="flex !items-center justify-between" color="red">
				<span>
					Delete this invited user. Their invitation link will stop working.
				</span>
				<Button color="red" onClick={() => setOpen(true)}>
					Delete
				</Button>
			</Alert>
			<DeleteDialog
				name={email ?? "this invited user"}
				noun="User"
				onConfirm={handleConfirm}
				onOpenChange={setOpen}
				open={open}
			/>
		</>
	);
}
