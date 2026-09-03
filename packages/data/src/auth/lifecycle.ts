import type { User } from "@virtool/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "../db/pg";
import { authAccounts, authTwoFactors } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { getUser } from "../users/data";
import { hashPassword } from "./password";
import {
	consumeSetupToken,
	invalidateUserSetupSessions,
	SetupCredentialError,
	supersedeSetupTokens,
} from "./setup";

/**
 * The Better Auth provider a Virtool handle-and-password identity is held
 * under.
 *
 * Better Auth resolves a credential by `(providerId, accountId)`, and
 * `accountId` is the Virtool user id, so a user has at most one of these — a
 * rule the `auth_accounts_provider_id_account_id_key` constraint holds.
 */
const CREDENTIAL_PROVIDER_ID = "credential";

/** Thrown when a completion is aimed at an account that is not eligible. */
export class SetupNotEligibleError extends AppError {}

/** Thrown when the address a completion would establish is already in use. */
export class EmailInUseError extends AppError {}

/** Thrown when TOTP enrollment has not actually happened. */
export class TotpNotEnrolledError extends AppError {}

/**
 * Fold an address to the one form it is compared and stored in.
 *
 * Lower-cased and trimmed, because a person who typed `Ada@Example.com` and a
 * person who typed `ada@example.com` are one person as far as recovery mail is
 * concerned.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Claim `email` for `userId`, or throw {@link EmailInUseError}.
 *
 * **`users.email` carries no unique constraint and cannot yet.** Legacy rows
 * share an empty address and duplicate real ones exist, so an index would fail
 * to build against a production database. Until those are resolved, the rule
 * is held here.
 *
 * A `SELECT` alone would not hold it: two transactions claiming one address
 * would both find it free and both commit. So the claim runs under a
 * transaction-scoped advisory lock keyed on the normalized address, which is
 * what makes exactly one of them the winner. `hashtext` is applied in
 * Postgres, so the key is derived the same way every session derives it.
 */
async function claimEmail(
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
			and(sql`lower(${users.email}) = ${email}`, sql`${users.id} <> ${userId}`),
		)
		.limit(1);

	if (taken.length > 0) {
		throw new EmailInUseError();
	}
}

/**
 * Give a user the Better Auth credential identity that lets the interactive
 * endpoints authenticate them.
 *
 * Three things together make an identity: the `auth_accounts` row holding the
 * password, and the `username`/`display_username` pair the `username` plugin
 * matches a sign-in against. Without the pair the row exists but no sign-in
 * resolves to it.
 *
 * `onConflictDoNothing` rather than an insert: a completion retried after its
 * transaction already committed must not mint a second identity, and the
 * `(provider_id, account_id)` constraint is what it lands on.
 *
 * `username` is the lower-cased handle and `display_username` the handle as
 * typed, which is the split the plugin draws and the same one
 * `users_handle_lower_unique` already holds.
 */
async function establishAuthIdentity(
	tx: DbOrTx,
	userId: number,
	handle: string,
	passwordHash: string,
): Promise<void> {
	const now = new Date();

	await tx
		.insert(authAccounts)
		.values({
			accountId: String(userId),
			providerId: CREDENTIAL_PROVIDER_ID,
			userId,
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing({
			target: [authAccounts.providerId, authAccounts.accountId],
		});

	await tx
		.update(users)
		.set({ username: handle.toLowerCase(), displayUsername: handle })
		.where(eq(users.id, userId));
}

/** What {@link completeAccountSetup} accepts. */
export type CompleteAccountSetupInput = {
	/** The plaintext setup token from the invitation or bootstrap link. */
	token: string;
	/** The password the holder chose. Never one an administrator picked. */
	password: string;
	/** The address the holder confirmed. */
	email: string;
};

/**
 * Turn a pending account into a usable one, authorized by an
 * `account_completion` setup token.
 *
 * Everything happens in one transaction: the token is spent, the address is
 * claimed, the credential is written on both sides of the migration, the
 * account leaves `pending`, and every setup credential the user holds is
 * revoked. A failure anywhere rolls the whole transition back, so a spent
 * token never outlives the account change it paid for.
 *
 * The password is written twice on purpose. `users.password` is what
 * `login()` in the web app still reads, and `auth_accounts.password` is what
 * Better Auth reads; both boundaries are live during the migration, and an
 * account completed against only one of them cannot sign in at all under the
 * other. Both hold the same bcrypt hash at the same cost, because
 * `@virtool/data/auth/password` is the one place that cost is stated and
 * Better Auth is configured to use it.
 *
 * No session is minted here. Which session a completed holder gets is the
 * calling flow's decision, and the web app owns cookies.
 */
export async function completeAccountSetup(
	db: Db,
	{ token, password, email }: CompleteAccountSetupInput,
): Promise<User> {
	const normalized = normalizeEmail(email);

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const hashed = await hashPassword(password);

	const userId = await db.transaction(async (tx) => {
		const consumed = await consumeSetupToken(tx, token, "account_completion");

		const [row] = await tx
			.select({
				handle: users.handle,
				lifecycleState: users.lifecycleState,
			})
			.from(users)
			.where(eq(users.id, consumed.userId))
			.limit(1);

		if (!row) {
			throw new SetupCredentialError();
		}

		if (row.lifecycleState !== "pending") {
			throw new SetupNotEligibleError();
		}

		await claimEmail(tx, consumed.userId, normalized);

		await tx
			.update(users)
			.set({
				password: hashed,
				email: normalized,
				emailVerified: true,
				forceReset: false,
				lastPasswordChange: new Date(),
				lifecycleState: "normal",
			})
			.where(eq(users.id, consumed.userId));

		await establishAuthIdentity(
			tx,
			consumed.userId,
			row.handle,
			hashed.toString("utf8"),
		);

		// The token just spent is gone, but a second outstanding link for the
		// same purpose would still work. Completion has to close every door it
		// opened, not just the one it came through.
		await supersedeSetupTokens(tx, consumed.userId, "account_completion");
		await invalidateUserSetupSessions(tx, consumed.userId);

		return consumed.userId;
	});

	// An administrator watching the user list sees the account leave pending.
	await emit("users", userId, "update");

	return getUser(db, userId);
}

/** What {@link completeEmailRemediation} accepts. */
export type CompleteEmailRemediationInput = {
	/** The plaintext setup token from the remediation link. */
	token: string;
	/** The address the holder confirmed. */
	email: string;
};

/**
 * Give an active legacy account a usable unique address and a Better Auth
 * identity, authorized by an `email_remediation` setup token.
 *
 * Bounded to an eligible account: `normal`, active, and still carrying the
 * legacy `users.password` hash this identity is derived from. A pending
 * account is not remediated — it has no credential to carry over — and an
 * account that already has an identity has nothing to remediate.
 *
 * The existing password hash moves across rather than being re-derived: the
 * holder is proving control of an address, not setting a new credential, and
 * asking them for their password again would make this a reset.
 */
export async function completeEmailRemediation(
	db: Db,
	{ token, email }: CompleteEmailRemediationInput,
): Promise<User> {
	const normalized = normalizeEmail(email);

	if (!normalized) {
		throw new EmailInUseError();
	}

	const userId = await db.transaction(async (tx) => {
		const consumed = await consumeSetupToken(tx, token, "email_remediation");

		const [row] = await tx
			.select({
				handle: users.handle,
				lifecycleState: users.lifecycleState,
				password: users.password,
			})
			.from(users)
			.where(eq(users.id, consumed.userId))
			.limit(1);

		if (!row) {
			throw new SetupCredentialError();
		}

		if (row.lifecycleState !== "normal" || row.password === null) {
			throw new SetupNotEligibleError();
		}

		await claimEmail(tx, consumed.userId, normalized);

		await tx
			.update(users)
			.set({ email: normalized, emailVerified: true })
			.where(eq(users.id, consumed.userId));

		await establishAuthIdentity(
			tx,
			consumed.userId,
			row.handle,
			row.password.toString("utf8"),
		);

		await supersedeSetupTokens(tx, consumed.userId, "email_remediation");
		await invalidateUserSetupSessions(tx, consumed.userId);

		return consumed.userId;
	});

	await emit("users", userId, "update");

	return getUser(db, userId);
}

/** What {@link completeTotpEnrollment} accepts. */
export type CompleteTotpEnrollmentInput = {
	/** The user the restricted session names. */
	userId: number;
};

/**
 * Release a user from required-MFA restriction, once they have actually
 * enrolled.
 *
 * This confirms rather than performs: Better Auth's two-factor endpoints write
 * `auth_two_factors` and set `users.two_factor_enabled`, and only a *verified*
 * row counts — an enrollment that minted a secret but never had a code checked
 * against it is not enrollment.
 *
 * The check and the revocation are one transaction, so a caller cannot lose
 * the restriction against an enrollment that then rolls back.
 *
 * There is no setup token. The holder of a required-MFA restriction got it by
 * authenticating, not by following a link, so there is nothing to spend.
 */
export async function completeTotpEnrollment(
	db: Db,
	{ userId }: CompleteTotpEnrollmentInput,
): Promise<User> {
	await db.transaction(async (tx) => {
		const [row] = await tx
			.select({ id: authTwoFactors.id })
			.from(authTwoFactors)
			.innerJoin(users, eq(users.id, authTwoFactors.userId))
			.where(
				and(
					eq(authTwoFactors.userId, userId),
					eq(authTwoFactors.verified, true),
					eq(users.active, true),
					eq(users.lifecycleState, "normal"),
				),
			)
			.limit(1);

		if (!row) {
			throw new TotpNotEnrolledError();
		}

		await tx
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));

		await invalidateUserSetupSessions(tx, userId);
	});

	await emit("users", userId, "update");

	return getUser(db, userId);
}
