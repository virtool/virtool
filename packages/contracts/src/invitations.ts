import type { User } from "./users";

/** How long an account invitation remains usable. */
export const INVITATION_LIFETIME_HOURS = 72;

/** How an account-completion link is handed to its recipient. */
export type InvitationDelivery = "copy_only" | "queued";

/** The safe administrative view of an account invitation. */
export type Invitation = {
	id: number;
	userId: number;
	email: string;
	issuerUserId: number;
	generation: number;
	createdAt: Date;
	expiresAt: Date;
	consumedAt: Date | null;
	supersededAt: Date | null;
	delivery: InvitationDelivery;
	outboxStatus: "queued" | "accepted" | "failed" | null;
};

/** The one response that contains a newly issued invitation secret. */
export type CreatedInvitation = {
	user: User;
	invitation: Invitation;
	setupToken: string | null;
};

/** Public requirements revealed only by a currently usable setup token. */
export type AccountSetupInspection =
	| {
			status: "valid";
			email: string;
			expiresAt: Date;
	  }
	| { status: "unusable" };

/** Result of accepting an account invitation. */
export type AccountSetupAcceptance = {
	user: User;
	emailVerificationRequired: boolean;
	nextRoute: "/";
};
