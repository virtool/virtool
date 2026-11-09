import Alert from "@base/Alert";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import { useRevokeUserAccess } from "@users/queries";
import { useState } from "react";

type RevokeUserAccessProps = {
	userId: number;
	handle: string;
};

/** A danger-zone control that removes every credential a user holds. */
export function RevokeUserAccess({ userId, handle }: RevokeUserAccessProps) {
	const [open, setOpen] = useState(false);
	const mutation = useRevokeUserAccess();

	return (
		<>
			<Alert className="flex !items-center justify-between" color="red">
				<span>
					Remove all credentials and sessions for this user. Use this if their
					account is compromised.
				</span>
				<Button color="red" onClick={() => setOpen(true)}>
					Revoke
				</Button>
			</Alert>
			<DeleteDialog
				name={handle}
				noun="Access"
				title="Revoke Access"
				message={
					<>
						Remove all access for <strong>{handle}</strong>? They are signed out
						everywhere. Their password, API keys, passkeys, two-factor
						authentication, and outstanding links stop working, and their email
						address is no longer verified. They are not notified. To restore
						access, send them a recovery link through a channel you trust.
					</>
				}
				onConfirm={() => mutation.mutateAsync(userId)}
				onOpenChange={setOpen}
				open={open}
			/>
		</>
	);
}
