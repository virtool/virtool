import { and, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { users } from "../db/schema/users";
import { AppError } from "../errors";

/** Thrown when an address is already assigned to another account. */
export class EmailInUseError extends AppError {}

/**
 * The normalized form of an email address.
 *
 * Trims surrounding whitespace and folds case. Provider-specific rules such as
 * dot removal and plus-address stripping are intentionally excluded.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Report whether an address has a usable shape.
 *
 * Deliberately loose to avoid rejecting deliverable addresses; delivery proves
 * the rest.
 */
export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** Claim a normalized address under a transaction-scoped advisory lock. */
export async function claimEmail(
	tx: DbOrTx,
	userId: number,
	email: string,
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
			),
		)
		.limit(1);

	if (taken.length > 0) {
		throw new EmailInUseError();
	}
}
