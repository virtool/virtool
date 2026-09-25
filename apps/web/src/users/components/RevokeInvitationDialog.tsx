import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { InputError } from "@base/Input";
import { useRevokeInvitation } from "@users/queries";
import { useState } from "react";

type RevokeInvitationDialogProps = {
	userId: number;
	email: string;
	disabled?: boolean;
};

/** A confirmation dialog that disables a user's current invitation link. */
export function RevokeInvitationDialog({
	userId,
	email,
	disabled = false,
}: RevokeInvitationDialogProps) {
	const [open, setOpen] = useState(false);
	const mutation = useRevokeInvitation();

	function onOpenChange(next: boolean) {
		mutation.reset();
		setOpen(next);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button as={DialogTrigger} color="red" disabled={disabled}>
				Revoke
			</Button>
			<DialogContent>
				<DialogTitle>Revoke Invitation</DialogTitle>
				<DialogDescription>
					The setup link sent to {email} will stop working. You can reissue the
					invitation later.
				</DialogDescription>
				<InputError>
					{mutation.isError ? mutation.error.message : ""}
				</InputError>
				<DialogFooter className="gap-2">
					<Button onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button
						color="red"
						disabled={mutation.isPending}
						onClick={() =>
							mutation.mutate(userId, { onSuccess: () => setOpen(false) })
						}
					>
						Revoke
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
