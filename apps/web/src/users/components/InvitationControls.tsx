import { formatDistanceStrict } from "@app/date";
import { useNow } from "@app/hooks";
import Alert from "@base/Alert";
import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import RelativeTime from "@base/RelativeTime";
import SectionHeader from "@base/SectionHeader";
import type { PaletteColor } from "@base/types";
import { useQuery } from "@tanstack/react-query";
import { invitationQueryOptions } from "@users/queries";
import type { Invitation } from "@virtool/contracts";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ReissueInvitationDialog } from "./ReissueInvitationDialog";

type InvitationState = "pending" | "expired" | "superseded" | "accepted";

const stateDescriptions: Record<InvitationState, string> = {
	pending:
		"An invitation link has been created for this user, but they have not accepted it yet.",
	expired:
		"The invitation link expired before this user accepted it. Reissue it to send a new link.",
	superseded: "A newer invitation link replaced this one.",
	accepted: "This user accepted the invitation.",
};

const stateBadges: Record<
	InvitationState,
	{ color: PaletteColor; label: string }
> = {
	pending: { color: "gray", label: "Pending" },
	expired: { color: "orange", label: "Expired" },
	superseded: { color: "gray", label: "Replaced" },
	accepted: { color: "green", label: "Accepted" },
};

function getInvitationState(
	invitation: Invitation,
	now: number,
): InvitationState {
	if (invitation.consumedAt) {
		return "accepted";
	}
	if (invitation.supersededAt) {
		return "superseded";
	}
	return invitation.expiresAt.getTime() <= now ? "expired" : "pending";
}

function getDeliveryDescription(invitation: Invitation): string {
	if (invitation.delivery === "copy_only") {
		return "Shared link";
	}

	switch (invitation.outboxStatus) {
		case "accepted":
			return "Email sent";
		case "failed":
			return "Email failed";
		default:
			return "Email queued";
	}
}

type InvitationFactProps = { label: string; children: ReactNode };

function InvitationFact({ label, children }: InvitationFactProps) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
				{label}
			</dt>
			<dd className="min-h-6 font-medium leading-6 first-letter:uppercase">
				{children}
			</dd>
		</div>
	);
}

type InvitationControlsProps = { userId: number };

/** The status of a pending user's invitation, with a control to replace it. */
export function InvitationControls({ userId }: InvitationControlsProps) {
	const { data } = useQuery(invitationQueryOptions(userId));
	const now = useNow();

	if (!data) {
		return null;
	}

	const state = getInvitationState(data, now);
	const badge = stateBadges[state];
	const expiry = formatDistanceStrict(data.expiresAt, now, {
		addSuffix: true,
	});

	return (
		<section className="mb-6">
			<SectionHeader level={3}>
				<h3>Invitation</h3>
				<p>{stateDescriptions[state]}</p>
			</SectionHeader>
			{data.outboxStatus === "failed" && state === "pending" && (
				<Alert color="red" icon={CircleAlert} level>
					The invitation email could not be sent. Reissue the invitation to try
					again or to share a link yourself.
				</Alert>
			)}
			<BoxGroup>
				<BoxGroupSection className="flex flex-wrap items-center justify-between gap-4">
					<dl className="flex flex-wrap gap-x-10 gap-y-3">
						<InvitationFact label="Status">
							<Badge color={badge.color} variant="soft">
								{badge.label}
							</Badge>
						</InvitationFact>
						<InvitationFact label="Delivery">
							{getDeliveryDescription(data)}
						</InvitationFact>
						<InvitationFact label="Sent">
							<RelativeTime time={data.createdAt} />
						</InvitationFact>
						{(state === "pending" || state === "expired") && (
							<InvitationFact
								label={state === "pending" ? "Expires" : "Expired"}
							>
								{expiry}
							</InvitationFact>
						)}
					</dl>
					{state !== "accepted" && (
						<ReissueInvitationDialog userId={userId} email={data.email} />
					)}
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
