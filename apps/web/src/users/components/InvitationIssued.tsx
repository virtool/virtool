import Button from "@base/Button";
import CopyField from "@base/CopyField";
import { DialogDescription, DialogFooter } from "@base/Dialog";
import { INVITATION_LIFETIME_HOURS } from "@virtool/contracts";
import { useState } from "react";

/** The outcome of issuing an invitation, shown once to the issuer. */
export type IssuedInvitation = {
	recipient: string;
	setupUrl: string | null;
	emailQueued: boolean;
};

type InvitationIssuedProps = {
	issued: IssuedInvitation;
	onDone: () => void;
	/** Whether this invitation replaced an earlier link. */
	replaced?: boolean;
};

/** Dialog body that confirms an invitation and shows its one-time link. */
export function InvitationIssued({
	issued,
	onDone,
	replaced = false,
}: InvitationIssuedProps) {
	const [copied, setCopied] = useState(false);

	return (
		<>
			<DialogDescription>
				{issued.emailQueued
					? `An invitation email to ${issued.recipient} has been queued. The link in it expires after ${INVITATION_LIFETIME_HOURS} hours.`
					: `Send this link to ${issued.recipient} so they can set up their account. It expires after ${INVITATION_LIFETIME_HOURS} hours and won’t be shown again.`}
				{replaced && " The previous link no longer works."}
			</DialogDescription>
			{issued.setupUrl && !issued.emailQueued && (
				<CopyField
					label="Account setup link"
					value={issued.setupUrl}
					onCopy={() => setCopied(true)}
				/>
			)}
			<DialogFooter>
				<Button
					color={copied || issued.emailQueued ? "blue" : "gray"}
					onClick={onDone}
				>
					Done
				</Button>
			</DialogFooter>
		</>
	);
}
