/** Number of seconds after sign-in that a browser session remains fresh. */
export const SESSION_FRESH_AGE_SECONDS = 15 * 60;

/** Sensitive mutations that require a recently authenticated browser session. */
export const PROTECTED_OPERATIONS = {
	accountPasswordChange: "account.password.change",
	accountEmailChange: "account.email.change",
	totpEnroll: "totp.enroll",
	totpDisable: "totp.disable",
	totpReset: "totp.reset",
	totpRecoveryCodesRegenerate: "totp.recovery_codes.regenerate",
	passkeyRegister: "passkey.register",
	passkeyRemove: "passkey.remove",
	passkeySecurityUpdate: "passkey.security.update",
	apiKeyCreate: "api_key.create",
	apiKeyPermissionsUpdate: "api_key.permissions.update",
	apiKeyDelete: "api_key.delete",
	apiKeyRotate: "api_key.rotate",
	sessionRevokeOther: "session.revoke.other",
	sessionRevokeAllOther: "session.revoke.all_other",
	invitationLinkIssue: "invitation_link.issue",
	setupLinkIssue: "setup_link.issue",
	recoveryLinkIssue: "recovery_link.issue",
} as const;

/** A mutation covered by the recent-authentication policy. */
export type ProtectedOperation =
	(typeof PROTECTED_OPERATIONS)[keyof typeof PROTECTED_OPERATIONS];

/** Whether `createdAt` is inside Better Auth's inclusive freshness boundary. */
export function isSessionFresh(createdAt: Date, now = Date.now()): boolean {
	return now - createdAt.getTime() < SESSION_FRESH_AGE_SECONDS * 1000;
}
