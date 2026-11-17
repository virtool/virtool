import type { AccountSecurity } from "@virtool/contracts";

const LOW_RECOVERY_CODES = 3;

/**
 * The warning to show when an account with TOTP on has few recovery codes
 * left, or null when it has enough.
 */
export function getRecoveryCodesWarning({
	recoveryCodesRemaining: remaining,
	twoFactorEnabled,
}: Pick<AccountSecurity, "recoveryCodesRemaining" | "twoFactorEnabled">):
	| string
	| null {
	if (
		!twoFactorEnabled ||
		remaining === null ||
		remaining > LOW_RECOVERY_CODES
	) {
		return null;
	}

	if (remaining === 0) {
		return "You have no recovery codes left. Make new codes so that you can sign in if you lose your authenticator app.";
	}

	return `Only ${remaining} recovery ${remaining === 1 ? "code is" : "codes are"} left. Make new codes so that you can sign in if you lose your authenticator app.`;
}
