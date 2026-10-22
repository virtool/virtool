import { and, isNotNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { users } from "../db/schema/users";
import { AppError } from "../errors";

/** Thrown when an address is already assigned to another account. */
export class EmailInUseError extends AppError {}

/** Options for {@link claimEmail}. */
type ClaimEmailOptions = {
	/** Whether the claimant proves control of the mailbox. */
	mailboxVerified?: boolean;
};

/**
 * Claim a normalized address under a transaction-scoped advisory lock.
 *
 * A legacy account's address was never verified, so it does not block a
 * claimant who proves control of the mailbox. This matches the unique index,
 * which covers migrated accounts only. An unverified claim refuses an address
 * that any other account records.
 */
export async function claimEmail(
	tx: DbOrTx,
	userId: number,
	email: string,
	{ mailboxVerified = false }: ClaimEmailOptions = {},
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtext(${`account_email:${email}`}))`,
	);

	const taken = await tx
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				sql`lower(trim(${users.email})) = ${email}`,
				sql`${users.id} <> ${userId}`,
				mailboxVerified ? isNotNull(users.authMigratedAt) : undefined,
			),
		)
		.limit(1);

	if (taken.length > 0) {
		throw new EmailInUseError();
	}
}
