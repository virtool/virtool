import {
	type AccountSetupInspection,
	EMAIL_REMEDIATION_RESEND_DELAY_SECONDS,
	EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS,
	type EmailRemediationState,
	type User,
} from "@virtool/contracts";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "../db/pg";
import { authAccounts, authSessions, authTwoFactors } from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { sessions } from "../db/schema/sessions";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { nowUtc } from "../db/time";
import { enqueueEmail } from "../email/outbox";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { getUser } from "../users/data";
import {
	claimEmail,
	EmailInUseError,
	isValidEmail,
	normalizeEmail,
} from "./email";
import { queueEmailVerificationInTransaction } from "./emailVerification";
import { isReservedHandle, isValidHandle } from "./handle";
import { CREDENTIAL_PROVIDER_ID, updateAuthUsername } from "./identity";
import { hashPassword } from "./password";
import {
	consumeSetupToken,
	invalidateUserSetupSessions,
	issueSetupTokenInTransaction,
	lockUserSetupCredentials,
	SetupCredentialError,
	supersedeSetupTokens,
} from "./setup";
import { hashToken } from "./tokens";

/** Thrown when a completion is aimed at an account that is not eligible. */
export class SetupNotEligibleError extends AppError {}

/** Thrown when a chosen account handle is already in use. */
export class AccountSetupHandleInUseError extends AppError {}

export { EmailInUseError } from "./email";

/** Thrown when a remediation message is requested before the resend window. */
export class EmailRemediationRateLimitedError extends AppError {}

/** Thrown when TOTP enrollment has not actually happened. */
export class TotpNotEnrolledError extends AppError {}

export { normalizeEmail } from "./email";

/**
 * Give a user the Better Auth credential identity that lets the interactive
 * endpoints authenticate them.
 *
 * Four things together make an identity: the `auth_accounts` row holding the
 * password, the `username`/`display_username` pair the `username` plugin
 * matches a sign-in against, and `auth_migrated_at`, which admits the address
 * to the normalized uniqueness index. They are established in one transaction.
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

	const inserted = await tx
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
		})
		.returning({ id: authAccounts.id });

	if (inserted.length === 0) {
		const [existing] = await tx
			.select({
				userId: authAccounts.userId,
				password: authAccounts.password,
			})
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
					eq(authAccounts.accountId, String(userId)),
				),
			)
			.limit(1);

		if (existing?.userId !== userId) {
			throw new SetupCredentialError();
		}
		if (existing.password === null) {
			await tx
				.update(authAccounts)
				.set({ password: passwordHash, updatedAt: now })
				.where(
					and(
						eq(authAccounts.userId, userId),
						eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
						isNull(authAccounts.password),
					),
				);
		} else if (existing.password !== passwordHash) {
			throw new SetupCredentialError();
		}
	}

	await updateAuthUsername(tx, userId, handle);
	await tx
		.update(users)
		.set({
			authMigratedAt: sql`coalesce(${users.authMigratedAt}, timezone('utc', now()))`,
		})
		.where(eq(users.id, userId));
}

/** What {@link completeAccountSetup} accepts. */
export type CompleteAccountSetupInput = {
	/** The plaintext setup token from the invitation or bootstrap link. */
	token: string;
	/** The password the holder chose. Never one an administrator picked. */
	password: string;
	/** The handle selected by the invitation holder. */
	handle?: string;
	/** Whether mailbox verification mail can be queued for a copied link. */
	deliveryAvailable?: boolean;
	/** Build a public verification URL if copied-link acceptance needs one. */
	getVerificationUrl?: (token: string) => string;
};

/** A completed pending-account transition and its follow-up requirement. */
export type CompletedAccountSetup = {
	user: User;
	emailVerificationRequired: boolean;
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
	{
		token,
		password,
		handle: requestedHandle,
		deliveryAvailable = false,
		getVerificationUrl = () => "",
	}: CompleteAccountSetupInput,
): Promise<CompletedAccountSetup> {
	const [preflight] = await db
		.select({ id: setupTokens.id })
		.from(setupTokens)
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, "account_completion"),
				isNull(setupTokens.consumedAt),
				isNull(setupTokens.supersededAt),
				sql`${setupTokens.expiresAt} > ${nowUtc()}`,
			),
		)
		.limit(1);
	if (!preflight) {
		throw new SetupCredentialError();
	}

	// Hashing is CPU-bound and slow by design, so it happens before the
	// transaction opens rather than holding one idle for the duration.
	const hashed = await hashPassword(password);

	const completed = await db
		.transaction(async (tx) => {
			const [target] = await tx
				.select({ userId: setupTokens.userId })
				.from(setupTokens)
				.where(
					and(
						eq(setupTokens.tokenHash, hashToken(token)),
						eq(setupTokens.purpose, "account_completion"),
					),
				)
				.limit(1);
			if (!target) {
				throw new SetupCredentialError();
			}
			await lockUserSetupCredentials(tx, target.userId);
			const consumed = await consumeSetupToken(tx, token, "account_completion");

			const [row] = await tx
				.select({
					active: users.active,
					email: users.email,
					handle: users.handle,
					lifecycleState: users.lifecycleState,
				})
				.from(users)
				.where(eq(users.id, consumed.userId))
				.limit(1);

			if (!row) {
				throw new SetupCredentialError();
			}

			if (
				!row.active ||
				row.lifecycleState !== "pending" ||
				!consumed.candidateEmail
			) {
				throw new SetupNotEligibleError();
			}
			const handle = requestedHandle?.trim() || row.handle;
			if (!isValidHandle(handle) || isReservedHandle(handle)) {
				throw new SetupNotEligibleError();
			}
			const [conflict] = await tx
				.select({ id: users.id })
				.from(users)
				.where(
					and(
						sql`lower(${users.handle}) = ${handle.toLowerCase()}`,
						sql`${users.id} <> ${consumed.userId}`,
					),
				)
				.limit(1);
			if (conflict) {
				throw new AccountSetupHandleInUseError();
			}

			const email = normalizeEmail(consumed.candidateEmail);
			if (email !== normalizeEmail(row.email)) {
				throw new SetupNotEligibleError();
			}
			await claimEmail(tx, consumed.userId, email);
			const verified = consumed.delivery === "queued";

			await tx
				.update(users)
				.set({
					handle,
					password: hashed,
					email,
					emailVerified: verified,
					forceReset: false,
					lastPasswordChange: new Date(),
					lifecycleState: "normal",
				})
				.where(eq(users.id, consumed.userId));

			await establishAuthIdentity(
				tx,
				consumed.userId,
				handle,
				hashed.toString("utf8"),
			);

			// The token just spent is gone, but a second outstanding link for the
			// same purpose would still work. Completion has to close every door it
			// opened, not just the one it came through.
			await tx
				.update(setupTokens)
				.set({ supersededAt: sql`${nowUtc()}` })
				.where(
					and(
						eq(setupTokens.userId, consumed.userId),
						isNull(setupTokens.consumedAt),
						isNull(setupTokens.supersededAt),
					),
				);
			await invalidateUserSetupSessions(tx, consumed.userId);
			await Promise.all([
				tx.delete(authSessions).where(eq(authSessions.userId, consumed.userId)),
				tx.delete(sessions).where(eq(sessions.userId, consumed.userId)),
			]);

			let emailVerificationRequired = false;
			if (!verified && deliveryAvailable) {
				const verification = await queueEmailVerificationInTransaction(tx, {
					userId: consumed.userId,
					candidateEmail: email,
					sourceEmail: email,
					handle,
					getVerificationUrl,
				});
				emailVerificationRequired = verification.queued;
			}

			return { userId: consumed.userId, emailVerificationRequired };
		})
		.catch((error: unknown) => {
			const cause =
				error && typeof error === "object" && "cause" in error
					? error.cause
					: error;
			if (
				cause &&
				typeof cause === "object" &&
				"constraint_name" in cause &&
				(cause.constraint_name === "users_handle_lower_unique" ||
					cause.constraint_name === "users_username_key")
			) {
				throw new AccountSetupHandleInUseError();
			}
			throw error;
		});

	// An administrator watching the user list sees the account leave pending.
	await emit("users", completed.userId, "update");

	const user = await getUser(db, completed.userId);
	return {
		user,
		emailVerificationRequired: completed.emailVerificationRequired,
	};
}

/** Inspect a usable invitation without revealing why any other token failed. */
export async function inspectAccountSetup(
	db: Db,
	token: string,
): Promise<AccountSetupInspection> {
	const [row] = await db
		.select({
			active: users.active,
			email: users.email,
			expiresAt: setupTokens.expiresAt,
			lifecycleState: users.lifecycleState,
		})
		.from(setupTokens)
		.innerJoin(users, eq(users.id, setupTokens.userId))
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, "account_completion"),
				isNull(setupTokens.consumedAt),
				isNull(setupTokens.supersededAt),
				sql`${setupTokens.expiresAt} > ${nowUtc()}`,
			),
		)
		.limit(1);
	if (!row?.active || row.lifecycleState !== "pending") {
		return { status: "unusable" };
	}
	return {
		status: "valid",
		email: row.email,
		expiresAt: row.expiresAt,
	};
}

/** What {@link completeEmailRemediation} accepts. */
export type CompleteEmailRemediationInput = {
	/** The plaintext setup token from the remediation link. */
	token: string;
	/** The restricted setup user expected by an offline completion. */
	userId?: number;
	/** Whether a real mailbox challenge was completed. */
	verified: boolean;
};

/** What {@link prepareEmailRemediation} accepts. */
export type PrepareEmailRemediationInput = {
	/** The normalized address to stage for the restricted user. */
	email: string;
	/** The restricted setup principal staging its own address. */
	userId: number;
};

/** The staged identity facts needed to address a verification message. */
export type PreparedEmailRemediation = {
	email: string;
	handle: string;
};

/** What {@link startEmailRemediation} accepts. */
export type StartEmailRemediationInput = PrepareEmailRemediationInput & {
	/** Whether this request may place a mailbox challenge in the outbox. */
	deliveryAvailable: boolean;
	/** Build the public mailbox-challenge URL around the new bearer token. */
	getVerificationUrl: (token: string) => string;
	/** The restricted browser session to keep alive for the challenge lifetime. */
	setupSessionId?: string;
};

/** Whether remediation now waits for mail or can finish under offline policy. */
export type EmailRemediationStart =
	| { status: "verification_required" }
	| { status: "offline"; token: string };

/** Read the staged address for an eligible restricted remediation holder. */
export async function getEmailRemediationState(
	db: Db,
	userId: number,
): Promise<EmailRemediationState> {
	const [row] = await db
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			emailVerified: users.emailVerified,
			lifecycleState: users.lifecycleState,
			password: users.password,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!row?.active || row.lifecycleState !== "normal") {
		throw new SetupNotEligibleError();
	}
	if (row.authMigratedAt !== null) {
		if (row.emailVerified) {
			return { status: "verified" };
		}
		throw new SetupNotEligibleError();
	}
	if (row.password === null) {
		throw new SetupNotEligibleError();
	}

	const [staged] = await db
		.select({
			id: setupTokens.id,
			email: setupTokens.candidateEmail,
			createdAt: setupTokens.createdAt,
			expiresAt: setupTokens.expiresAt,
			canResend: sql<boolean>`${setupTokens.createdAt} <= timezone('utc', clock_timestamp()) - make_interval(secs => ${EMAIL_REMEDIATION_RESEND_DELAY_SECONDS})`,
		})
		.from(setupTokens)
		.where(
			and(
				eq(setupTokens.userId, userId),
				eq(setupTokens.purpose, "email_remediation"),
				isNull(setupTokens.consumedAt),
				isNull(setupTokens.supersededAt),
				sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
			),
		)
		.limit(1);

	if (!staged?.email) {
		return { status: "input" };
	}

	const resendAt = new Date(
		staged.createdAt.getTime() + EMAIL_REMEDIATION_RESEND_DELAY_SECONDS * 1000,
	);
	const [delivery] = await db
		.select({ status: emailOutbox.status })
		.from(emailOutbox)
		.where(
			eq(
				emailOutbox.idempotency_key,
				`email_remediation/${userId}/${staged.id}`,
			),
		)
		.limit(1);

	return {
		status: "pending",
		maskedEmail: maskEmail(staged.email),
		expiresAt: staged.expiresAt,
		resendAt,
		canResend: staged.canResend,
		deliveryFailed: delivery?.status === "failed",
	};
}

function maskEmail(email: string): string {
	const separator = email.lastIndexOf("@");
	if (separator <= 0) {
		return "***";
	}
	const local = email.slice(0, separator);
	const domain = email.slice(separator + 1);
	const visible =
		local.length > 2 ? `${local[0]}***${local.at(-1)}` : `${local[0]}***`;
	return `${visible}@${domain}`;
}

/**
 * Validate a candidate address for an eligible legacy identity.
 *
 * The candidate is only checked here. The setup token carries it until
 * completion so an abandoned mailbox challenge cannot reserve the address.
 */
export async function prepareEmailRemediation(
	db: Db,
	{ email, userId }: PrepareEmailRemediationInput,
): Promise<PreparedEmailRemediation> {
	return db.transaction((tx) =>
		prepareEmailRemediationInTransaction(tx, { email, userId }),
	);
}

async function prepareEmailRemediationInTransaction(
	tx: DbOrTx,
	{ email, userId }: PrepareEmailRemediationInput,
): Promise<PreparedEmailRemediation> {
	const normalized = normalizeEmail(email);

	if (!isValidEmail(normalized)) {
		throw new EmailInUseError();
	}

	await lockUserSetupCredentials(tx, userId);

	const [row] = await tx
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			handle: users.handle,
			lifecycleState: users.lifecycleState,
			password: users.password,
		})
		.from(users)
		.where(eq(users.id, userId))
		.for("update")
		.limit(1);

	if (
		!row?.active ||
		row.authMigratedAt !== null ||
		row.lifecycleState !== "normal" ||
		row.password === null
	) {
		throw new SetupNotEligibleError();
	}

	await claimEmail(tx, userId, normalized);

	return { email: normalized, handle: row.handle };
}

/** Atomically stage an address, replace its token, and enqueue its challenge. */
export async function startEmailRemediation(
	db: Db,
	input: StartEmailRemediationInput,
): Promise<EmailRemediationStart> {
	return db.transaction((tx) => startEmailRemediationInTransaction(tx, input));
}

async function startEmailRemediationInTransaction(
	tx: DbOrTx,
	{
		deliveryAvailable,
		email,
		getVerificationUrl,
		setupSessionId,
		userId,
	}: StartEmailRemediationInput,
): Promise<EmailRemediationStart> {
	const prepared = await prepareEmailRemediationInTransaction(tx, {
		email,
		userId,
	});
	const issued = await issueSetupTokenInTransaction(tx, {
		candidateEmail: prepared.email,
		lifetimeMs: EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS * 60 * 60 * 1000,
		purpose: "email_remediation",
		userId,
	});
	if (setupSessionId) {
		await tx
			.update(setupSessions)
			.set({ expiresAt: issued.expiresAt })
			.where(
				and(
					eq(setupSessions.sessionId, setupSessionId),
					eq(setupSessions.userId, userId),
					eq(setupSessions.purpose, "email_remediation"),
				),
			);
	}
	if (!deliveryAvailable) {
		return { status: "offline", token: issued.token };
	}
	const delivery = await enqueueEmail(tx, {
		idempotencyKey: `email_remediation/${userId}/${issued.tokenId}`,
		recipient: prepared.email,
		setupTokenId: issued.tokenId,
		template: {
			type: "email_verification",
			username: prepared.handle,
			verifyUrl: getVerificationUrl(issued.token),
			expiresInHours: EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS,
		},
	});

	return delivery.status === "queued"
		? { status: "verification_required" }
		: { status: "offline", token: issued.token };
}

/** Reissue the current remediation challenge after the resend interval. */
export async function resendEmailRemediation(
	db: Db,
	input: Omit<StartEmailRemediationInput, "email">,
): Promise<EmailRemediationStart> {
	return db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, input.userId);
		const [current] = await tx
			.select({
				canResend: sql<boolean>`${setupTokens.createdAt} <= timezone('utc', clock_timestamp()) - make_interval(secs => ${EMAIL_REMEDIATION_RESEND_DELAY_SECONDS})`,
				email: setupTokens.candidateEmail,
			})
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.userId, input.userId),
					eq(setupTokens.purpose, "email_remediation"),
					isNull(setupTokens.consumedAt),
					isNull(setupTokens.supersededAt),
					sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
				),
			)
			.limit(1);
		if (!current?.email) {
			throw new SetupCredentialError();
		}
		if (!current.canResend) {
			throw new EmailRemediationRateLimitedError();
		}
		return startEmailRemediationInTransaction(tx, {
			...input,
			email: current.email,
		});
	});
}

/** Return a restricted remediation holder to address entry. */
export async function changeEmailRemediation(
	db: Db,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		await supersedeSetupTokens(tx, userId, "email_remediation");
	});
}

/** Revoke an outstanding remediation challenge and every restricted session. */
export async function cancelEmailRemediation(
	db: Db,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		await supersedeSetupTokens(tx, userId, "email_remediation");
		await invalidateUserSetupSessions(tx, userId);
	});
}

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
	{ token, userId: expectedUserId, verified }: CompleteEmailRemediationInput,
): Promise<User> {
	const userId = await db.transaction(async (tx) => {
		const [credential] = await tx
			.select({ userId: setupTokens.userId })
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.tokenHash, hashToken(token)),
					eq(setupTokens.purpose, "email_remediation"),
				),
			)
			.limit(1);
		if (
			!credential ||
			(expectedUserId && credential.userId !== expectedUserId)
		) {
			throw new SetupCredentialError();
		}
		await lockUserSetupCredentials(tx, credential.userId);
		const consumed = await consumeSetupToken(tx, token, "email_remediation");
		if (!consumed.candidateEmail || !isValidEmail(consumed.candidateEmail)) {
			throw new SetupCredentialError();
		}

		const [row] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
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

		if (
			!row.active ||
			row.authMigratedAt !== null ||
			row.lifecycleState !== "normal" ||
			row.password === null
		) {
			throw new SetupNotEligibleError();
		}

		const normalized = normalizeEmail(consumed.candidateEmail);
		await claimEmail(tx, consumed.userId, normalized);

		await tx
			.update(users)
			.set({ email: normalized, emailVerified: verified })
			.where(eq(users.id, consumed.userId));

		await establishAuthIdentity(
			tx,
			consumed.userId,
			row.handle,
			row.password.toString("utf8"),
		);

		await supersedeSetupTokens(tx, consumed.userId, "email_remediation");
		await tx.delete(sessions).where(eq(sessions.userId, consumed.userId));
		await tx
			.delete(authSessions)
			.where(eq(authSessions.userId, consumed.userId));

		return consumed.userId;
	});

	await emit("users", userId, "update");

	return getUser(db, userId);
}

/** Outcome of public token verification, with the user id kept server-side. */
export type EmailRemediationTokenResult = {
	status:
		| "verified"
		| "already_verified"
		| "expired"
		| "superseded"
		| "unusable";
	userId?: number;
};

/** Verify a remediation bearer token without requiring a browser session. */
export async function verifyEmailRemediationToken(
	db: Db,
	token: string,
): Promise<EmailRemediationTokenResult> {
	try {
		const user = await completeEmailRemediation(db, { token, verified: true });
		return { status: "verified", userId: user.id };
	} catch (error) {
		if (
			!(error instanceof SetupCredentialError) &&
			!(error instanceof SetupNotEligibleError)
		) {
			throw error;
		}
	}

	const [row] = await db
		.select({
			active: users.active,
			candidateEmail: setupTokens.candidateEmail,
			consumedAt: setupTokens.consumedAt,
			email: users.email,
			emailVerified: users.emailVerified,
			expired: sql<boolean>`${setupTokens.expiresAt} <= timezone('utc', clock_timestamp())`,
			supersededAt: setupTokens.supersededAt,
			userId: setupTokens.userId,
		})
		.from(setupTokens)
		.innerJoin(users, eq(users.id, setupTokens.userId))
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, "email_remediation"),
			),
		)
		.limit(1);

	if (!row?.active) {
		return { status: "unusable" };
	}
	if (
		row.consumedAt &&
		row.emailVerified &&
		row.candidateEmail &&
		normalizeEmail(row.candidateEmail) === normalizeEmail(row.email)
	) {
		return { status: "already_verified", userId: row.userId };
	}
	if (row.supersededAt) {
		return { status: "superseded", userId: row.userId };
	}
	if (row.expired) {
		return { status: "expired", userId: row.userId };
	}
	return { status: "unusable" };
}

/** Confirm that a restricted holder's remediation completed elsewhere. */
export async function checkEmailRemediationComplete(
	db: Db,
	userId: number,
): Promise<void> {
	const [row] = await db
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			emailVerified: users.emailVerified,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!row?.active || !row.authMigratedAt || !row.emailVerified) {
		throw new SetupNotEligibleError();
	}
}

/** Claim the one restricted session that may be promoted after verification. */
export async function claimEmailRemediationPromotion(
	db: Db,
	userId: number,
	setupSessionId: string,
	requireVerified = true,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		const [row] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
				emailVerified: users.emailVerified,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (
			!row?.active ||
			!row.authMigratedAt ||
			(requireVerified && !row.emailVerified)
		) {
			return false;
		}
		const claimed = await tx
			.delete(setupSessions)
			.where(
				and(
					eq(setupSessions.sessionId, setupSessionId),
					eq(setupSessions.userId, userId),
					eq(setupSessions.purpose, "email_remediation"),
				),
			)
			.returning({ id: setupSessions.id });
		if (claimed.length === 0) {
			return false;
		}
		await invalidateUserSetupSessions(tx, userId);
		return true;
	});
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
