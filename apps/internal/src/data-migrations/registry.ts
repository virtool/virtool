import { forcedPasswordReset } from "./bodies/forced-password-reset";
import { legacyIdentities } from "./bodies/legacy-identities";
import { passkeyCredentialUniqueness } from "./bodies/passkey-credential-uniqueness";
import { primaryGroupUniqueness } from "./bodies/primary-group-uniqueness";
import { sampleNameUniqueness } from "./bodies/sample-name-uniqueness";
import { totpEnrollmentSetupState } from "./bodies/totp-enrollment-setup-state";
import { usernameBackfill } from "./bodies/username-backfill";
import type { DataMigrationRegistry } from "./define";

/**
 * Registered data migrations, indexed by their stable key.
 *
 * Keep a body after it ships: databases that have not reached its pair still
 * run it.
 */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[legacyIdentities.key]: legacyIdentities,
	[forcedPasswordReset.key]: forcedPasswordReset,
	[passkeyCredentialUniqueness.key]: passkeyCredentialUniqueness,
	[primaryGroupUniqueness.key]: primaryGroupUniqueness,
	[sampleNameUniqueness.key]: sampleNameUniqueness,
	[totpEnrollmentSetupState.key]: totpEnrollmentSetupState,
	[usernameBackfill.key]: usernameBackfill,
};
