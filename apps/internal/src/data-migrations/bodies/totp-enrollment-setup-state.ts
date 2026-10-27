import { type DataMigrationArgs, defineAudit } from "../define";

async function audit({ client, signal }: DataMigrationArgs) {
	signal.throwIfAborted();
	const sessions = await client`
		DELETE FROM public.setup_sessions WHERE purpose = 'totp_enrollment'
	`;

	signal.throwIfAborted();
	const tokens = await client`
		DELETE FROM public.setup_tokens WHERE purpose = 'totp_enrollment'
	`;

	return {
		setupSessionsDeleted: sessions.count,
		setupTokensDeleted: tokens.count,
	};
}

/**
 * Repair paired with the migration that retires the `totp_enrollment` setup
 * purpose. Enrollment no longer uses setup state, so outstanding rows are
 * deleted rather than reported.
 */
export const totpEnrollmentSetupState = defineAudit({
	key: "totp_enrollment_setup_state",
	version: 1,
	migrationTag: "0042_add_mfa_policy",
	kind: "audit",
	description: "delete setup sessions and tokens for retired totp enrollment",
	run: audit,
});
