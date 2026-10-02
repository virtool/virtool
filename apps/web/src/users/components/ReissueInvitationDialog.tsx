import { useFetchAccount } from "@account/account";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { FieldError } from "@base/Field";
import {
	useInvitationEmailAvailability,
	useRegenerateInvitation,
} from "@users/queries";
import { getAccountSetupUrl } from "@users/utils";
import { useState } from "react";
import {
	type DeliveryIntent,
	DeliveryIntentField,
} from "./DeliveryIntentField";
import { InvitationIssued, type IssuedInvitation } from "./InvitationIssued";

type ReissueInvitationDialogProps = {
	userId: number;
	email: string;
	disabled?: boolean;
};

/** A dialog that replaces a user's invitation link with a new one. */
export function ReissueInvitationDialog({
	userId,
	email,
	disabled = false,
}: ReissueInvitationDialogProps) {
	const [open, setOpen] = useState(false);
	const [chosenIntent, setChosenIntent] = useState<DeliveryIntent | null>(null);
	const [issued, setIssued] = useState<IssuedInvitation | null>(null);
	const { data: account } = useFetchAccount();
	const { data: emailDeliveryAvailable = false } =
		useInvitationEmailAvailability();
	const mutation = useRegenerateInvitation();

	// Availability loads after mount, so the default follows it until the
	// administrator picks an option.
	const deliveryIntent =
		chosenIntent ?? (emailDeliveryAvailable ? "email" : "copy_only");

	function onOpenChange(next: boolean) {
		mutation.reset();
		setChosenIntent(null);
		setIssued(null);
		setOpen(next);
	}

	function reissue() {
		mutation.mutate(
			{ userId, deliveryIntent },
			{
				onSuccess: (result) => {
					setIssued({
						recipient: email,
						setupUrl: result.setupToken
							? getAccountSetupUrl(result.setupToken)
							: null,
						emailQueued: result.invitation.delivery === "queued",
					});
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button as={DialogTrigger} color="blue" disabled={disabled}>
				Reissue
			</Button>
			<DialogContent>
				<DialogTitle>
					{issued ? "Invitation Reissued" : "Reissue Invitation"}
				</DialogTitle>
				{issued ? (
					<InvitationIssued
						issued={issued}
						onDone={() => onOpenChange(false)}
						replaced
					/>
				) : (
					<>
						<DialogDescription>
							Create a new setup link for {email}. The current link stops
							working.
						</DialogDescription>
						<DeliveryIntentField
							name="reissue-delivery-intent"
							value={deliveryIntent}
							onChange={setChosenIntent}
							emailDeliveryAvailable={emailDeliveryAvailable}
							canConfigureEmailDelivery={account?.administratorRole === "full"}
						/>
						<FieldError>
							{mutation.isError ? mutation.error.message : ""}
						</FieldError>
						<DialogFooter className="gap-2">
							<Button onClick={() => onOpenChange(false)}>Cancel</Button>
							<Button
								color="blue"
								disabled={mutation.isPending}
								onClick={reissue}
							>
								Reissue
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
