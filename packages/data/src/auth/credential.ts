// The Better Auth credential-account contract, and the one write that keeps a
// migrated credential in step with `users.password`.

import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authAccounts } from "../db/schema/auth";

/** The `provider_id` Better Auth gives a password account. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * The `account_id` a migrated user's credential carries.
 *
 * Better Auth sets `accountId` to the user's own id when it creates a
 * credential account, so the migration derives the same value rather than
 * minting one. The column is text and `users.id` is an integer, hence the
 * conversion — and `auth_accounts_provider_id_account_id_key` then makes "one
 * credential per user" a database rule.
 */
export function credentialAccountId(userId: number): string {
	return String(userId);
}

/**
 * Copy a new password hash onto a user's existing credential account.
 *
 * Until the authentication boundary moves to Better Auth, the legacy login path
 * is authoritative and every password write lands in `users.password`. A
 * migrated user also holds that hash in their credential account, so a write
 * that skipped this would leave the credential holding the previous password
 * and lock the user out at cutover.
 *
 * Runs in the caller's transaction, alongside the `users` update it mirrors. It
 * never creates an account: a user who has not been migrated keeps the
 * behaviour they have today, and eager backfill stays the migration's job.
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
