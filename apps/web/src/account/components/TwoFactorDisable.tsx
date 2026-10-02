import { resetClient } from "@app/utils";
import Alert from "@base/Alert";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useDisableTotp } from "../queries";
import TwoFactorPassword from "./TwoFactorPassword";

type TwoFactorDisableProps = {
	/** Whether the instance requires every user to use TOTP */
	mfaRequired: boolean;
};

/** A dialog that turns TOTP off after a password check. */
export default function TwoFactorDisable({
	mfaRequired,
}: TwoFactorDisableProps) {
	const mutation = useDisableTotp();
	const [open, setOpen] = useState(false);

	function handleOpenChange(next: boolean) {
		if (!next) {
			mutation.reset();
		}
		setOpen(next);
	}

	function handlePassword(password: string) {
		mutation.mutate(
			{ password },
			{
				onSuccess: () => {
					// The required policy now restricts this session to enrollment,
					// which only a full page load routes to.
					if (mfaRequired) {
						resetClient();
					} else {
						handleOpenChange(false);
					}
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<Button as={DialogTrigger} color="red">
				Turn off
			</Button>
			<DialogContent>
				<DialogTitle>Turn off two-factor authentication</DialogTitle>
				<DialogDescription>
					Your authenticator app and recovery codes stop working. Enter your
					password to continue.
				</DialogDescription>
				{mfaRequired && (
					<Alert color="orange" icon={TriangleAlert}>
						This Virtool instance requires two-factor authentication. You must
						set it up again before you can use Virtool.
					</Alert>
				)}
				<TwoFactorPassword
					error={mutation.error}
					isPending={mutation.isPending}
					onSubmit={handlePassword}
					submitLabel="Turn off"
				/>
			</DialogContent>
		</Dialog>
	);
}
