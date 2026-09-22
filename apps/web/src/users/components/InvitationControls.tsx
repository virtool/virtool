import Button from "@base/Button";
import { InputSimple } from "@base/Input";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import {
	invitationQueryOptions,
	useRegenerateInvitation,
	useRevokeInvitation,
} from "@users/queries";
import { useState } from "react";

type InvitationControlsProps = { userId: number };

/** Safe invitation status and one-time regeneration controls. */
export function InvitationControls({ userId }: InvitationControlsProps) {
	const { data } = useQuery(invitationQueryOptions(userId));
	const regenerate = useRegenerateInvitation();
	const revoke = useRevokeInvitation();
	const [setupUrl, setSetupUrl] = useState("");
	const [emailQueued, setEmailQueued] = useState(false);

	function issue(deliveryIntent: "copy_only" | "email") {
		regenerate.mutate(
			{ userId, deliveryIntent },
			{
				onSuccess: (result) => {
					setSetupUrl(
						result.setupToken
							? `${window.location.origin}/account-setup#token=${result.setupToken}`
							: "",
					);
					setEmailQueued(result.invitation.delivery === "queued");
				},
			},
		);
	}

	const state = data?.consumedAt
		? "accepted"
		: data?.revokedAt
			? "revoked"
			: data?.supersededAt
				? "superseded"
				: data
					? "pending"
					: "loading";

	return (
		<section className="mb-6">
			<SectionHeader>
				<h3>Invitation</h3>
			</SectionHeader>
			<p className="mb-3 capitalize">Status: {state}</p>
			{data?.outboxStatus && <p className="mb-3">Email: {data.outboxStatus}</p>}
			<div className="flex gap-2 mb-3">
				<Button type="button" onClick={() => issue("copy_only")}>
					New copy link
				</Button>
				<Button type="button" onClick={() => issue("email")}>
					Send new email
				</Button>
				<Button type="button" onClick={() => revoke.mutate(userId)}>
					Revoke
				</Button>
			</div>
			{emailQueued && <p>The new invitation email has been queued.</p>}
			{setupUrl && (
				<div>
					<p>This link will not be shown again.</p>
					<InputSimple
						readOnly
						value={setupUrl}
						aria-label="Account setup link"
					/>
					<Button
						type="button"
						onClick={() => navigator.clipboard.writeText(setupUrl)}
					>
						Copy link
					</Button>
				</div>
			)}
		</section>
	);
}
