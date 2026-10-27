import Alert from "@base/Alert";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import { useResetUserTotp } from "@users/queries";
import { useState } from "react";

type ResetUserTotpProps = {
	userId: number;
	handle: string;
};

/** A danger-zone control that removes a user's two-factor authentication. */
export function ResetUserTotp({ userId, handle }: ResetUserTotpProps) {
	const [open, setOpen] = useState(false);
	const mutation = useResetUserTotp();

	return (
		<>
			<Alert className="flex !items-center justify-between" color="red">
				<span>
					Remove two-factor authentication for this user. Use this if they lost
					their authenticator and recovery codes.
				</span>
				<Button color="red" onClick={() => setOpen(true)}>
					Reset
				</Button>
			</Alert>
			<DeleteDialog
				name={handle}
				noun="Two-Factor Authentication"
				message={
					<>
						Remove the authenticator and recovery codes for{" "}
						<strong>{handle}</strong>? They are signed out everywhere. If the
						instance requires two-factor authentication, they must set it up
						again at their next sign-in.
					</>
				}
				onConfirm={() => mutation.mutateAsync(userId)}
				onOpenChange={setOpen}
				open={open}
			/>
		</>
	);
}
