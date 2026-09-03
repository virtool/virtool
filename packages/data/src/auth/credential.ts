import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authAccounts } from "../db/schema/auth";

/** The `provider_id` Better Auth gives a password account. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * The `account_id` a migrated user's credential carries.
 *
 * Better Auth uses the user's id for credential accounts. The database's
 * provider/account unique constraint enforces one credential per user.
 */
export function credentialAccountId(userId: number): string {
	return String(userId);
}

/**
 * Copy a new password hash onto a user's existing credential account.
 *
 * Runs in the transaction that updates `users.password`. It never creates an
 * account, leaving backfill to the migration.
 */
export async function syncCredentialPassword(
	tx: DbOrTx,
	userId: number,
	hash: Buffer,
): Promise<void> {
	await tx
		.update(authAccounts)
		.set({ password: hash.toString("utf8"), updatedAt: new Date() })
		.where(
			and(
				eq(authAccounts.userId, userId),
				eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
			),
		);
}
