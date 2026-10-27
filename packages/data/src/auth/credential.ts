import { and, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { hashPassword, needsRehash, verifyPassword } from "./password";

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

/** The sign-in credentials whose stored hash {@link upgradePasswordHash} replaces. */
export type UpgradePasswordHashInput = {
	handle: string;
	password: string;
};

/**
 * Replace a user's outdated password hash after the user signs in with it.
 *
 * The password is checked again against the stored hash, so a caller cannot
 * write a hash for a password it did not prove. Both copies of the hash change
 * in one transaction, and each changes only while it still holds the hash
 * that was checked, so a password set during the upgrade is never overwritten.
 *
 * Returns whether the hash was replaced.
 */
export async function upgradePasswordHash(
	db: Db,
	{ handle, password }: UpgradePasswordHashInput,
): Promise<boolean> {
	const [user] = await db
		.select({ id: users.id, password: users.password })
		.from(users)
		.where(sql`lower(${users.handle}) = ${handle.toLowerCase()}`)
		.limit(1);

	if (
		!user?.password ||
		!needsRehash(user.password) ||
		!(await verifyPassword(password, user.password))
	) {
		return false;
	}

	const previous = user.password;
	const hashed = await hashPassword(password);

	return db.transaction(async (tx) => {
		const updated = await tx
			.update(users)
			.set({ password: hashed })
			.where(and(eq(users.id, user.id), eq(users.password, previous)))
			.returning({ id: users.id });

		if (updated.length === 0) {
			return false;
		}

		await tx
			.update(authAccounts)
			.set({ password: hashed.toString("utf8"), updatedAt: new Date() })
			.where(
				and(
					eq(authAccounts.userId, user.id),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
					eq(authAccounts.password, previous.toString("utf8")),
				),
			);

		return true;
	});
}
