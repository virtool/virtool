import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { useState } from "react";
import { useRegenerateRecoveryCodes } from "../queries";
import TwoFactorPassword from "./TwoFactorPassword";
import TwoFactorRecoveryCodes from "./TwoFactorRecoveryCodes";

/**
 * A dialog that replaces every recovery code after a password check.
 *
 * The new codes live only in this component's state.
 */
export default function TwoFactorRegenerate() {
	const mutation = useRegenerateRecoveryCodes();
	const [open, setOpen] = useState(false);
	const [codes, setCodes] = useState<string[] | null>(null);
	const [acknowledged, setAcknowledged] = useState(false);

	function handleOpenChange(next: boolean) {
		if (!next && codes && !acknowledged) {
			return;
		}

		if (!next) {
			setCodes(null);
			setAcknowledged(false);
			mutation.reset();
		}

		setOpen(next);
	}

	function handlePassword(password: string) {
		mutation.mutate({ password }, { onSuccess: (result) => setCodes(result) });
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<Button as={DialogTrigger}>New recovery codes</Button>
			<DialogContent>
				<DialogTitle>
					{codes ? "Save your recovery codes" : "Make new recovery codes"}
				</DialogTitle>
				<DialogDescription>
					{codes
						? "Your old recovery codes no longer work."
						: "Your old recovery codes stop working. Enter your password to continue."}
				</DialogDescription>
				{codes ? (
					<TwoFactorRecoveryCodes
						acknowledged={acknowledged}
						codes={codes}
						onAcknowledgedChange={setAcknowledged}
						onDone={() => handleOpenChange(false)}
					/>
				) : (
					<TwoFactorPassword
						error={mutation.error}
						isPending={mutation.isPending}
						onSubmit={handlePassword}
						submitLabel="Make new codes"
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
