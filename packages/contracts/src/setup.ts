import { z } from "zod";

/**
 * Where a Virtool human account sits between creation and ordinary use.
 *
 * `users.lifecycle_state` is a `text` column closed by the
 * `lifecycle_state_valid` CHECK constraint; this is the one declaration of
 * what that constraint admits, imported by the schema mirror rather than
 * restated there.
 *
 * This is not `users.active`. Activation stays the administrator's switch and
 * remains authoritative: a deactivated account cannot be used whatever its
 * lifecycle state, and completing setup never activates anyone.
 *
 * `pending` means the account exists — handle, administrator role and group
 * memberships are all assigned — but has no credential and cannot be used as
 * an application account. `normal` means it can.
 */
export const AccountLifecycleState = z.enum(["pending", "normal"]);

export type AccountLifecycleState = z.infer<typeof AccountLifecycleState>;

/**
 * The one transition a setup credential authorizes.
 *
 * A setup token and a restricted setup session each carry exactly one of
 * these, and each is refused for any other. `setup_tokens.purpose` and
 * `setup_sessions.purpose` are `text` columns closed by CHECK constraints;
 * this is the one declaration of what they admit.
 *
 * `account_completion` covers both an administrator's invitation and the
 * first-instance bootstrap: an account that exists but has no credential yet.
 * `email_remediation` covers an active legacy account with no usable unique
 * email. `totp_enrollment` covers a user who has authenticated under a
 * `required` MFA policy but has not enrolled.
 */
export const SetupPurpose = z.enum([
	"account_completion",
	"email_remediation",
	"totp_enrollment",
]);

export type SetupPurpose = z.infer<typeof SetupPurpose>;

/**
 * What a restricted setup session proves, and the whole of it.
 *
 * Deliberately not a principal. It carries no roles, no group permissions, no
 * administrator capability and no API-key permission cap, because a caller
 * holding one may complete `purpose` and do nothing else. The web
 * authentication boundary maps this into its own principal union; it must not
 * widen it on the way.
 *
 * `sessionId` is the non-secret half of the credential — safe to log and to
 * attribute an error to. The secret that proves the session is never part of
 * this shape.
 */
export type RestrictedSetup = {
	/** The Virtool user completing setup. */
	userId: number;

	/** The session's stable, non-secret identifier, for attribution. */
	sessionId: string;

	/** The only transition this session may complete. */
	purpose: SetupPurpose;

	/** When the session stops being valid. The server row is authoritative. */
	expiresAt: Date;
};

/**
 * What the server answers a caller whose credential reaches only a setup
 * surface.
 *
 * A restricted caller is neither anonymous nor an ordinary authenticated user,
 * so neither a 401 nor a bare 403 tells the router where to send them. This
 * carries the purpose and nothing else — no bearer token, no session secret,
 * and no statement about whether any given setup token exists.
 */
export type SetupRequired = {
	purpose: SetupPurpose;
};
