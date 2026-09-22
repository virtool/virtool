import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authAccounts, authSessions } from "../db/schema/auth";
import { sessions } from "../db/schema/sessions";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { enqueueEmail } from "../email/outbox";
import { EMAIL_DELIVERY_DEADLINE_SECONDS } from "../email/retry";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { CREDENTIAL_PROVIDER_ID } from "./identity";
import { hashPassword, verifyPassword } from "./password";
import {
	consumeSetupToken,
	invalidateUserSetupTokens,
	issueSetupTokenInTransaction,
	lockUserSetupCredentials,
	SetupCredentialError,
} from "./setup";
import { hashToken } from "./tokens";

const RECOVERY_LIFETIME_MS = 60 * 60 * 1000;
const EMAILED_RECOVERY_LIFETIME_MS =
	(EMAIL_DELIVERY_DEADLINE_SECONDS + 60 * 60) * 1000;

/** A recovery link cannot be issued for the requested account. */
export class RecoveryNotEligibleError extends AppError {}

/** The replacement password matches the current credential. */
export class RecoveryPasswordReuseError extends AppError {}

/** The requested public recovery message cannot be queued. */
export class RecoveryDeliveryUnavailableError extends AppError {}

/** The authority a recovery link carries. */
export type RecoveryPurpose = "password_recovery" | "administrator_recovery";

/** Inputs for issuing a purpose-bound password recovery link. */
export type IssueRecoveryLinkInput = {
	userId: number;
	purpose: RecoveryPurpose;
	issuerUserId?: number;
	deliveryAvailable: boolean;
	getRecoveryUrl: (token: string) => string;
};

/** An administrator's one-time link and bounded delivery result. */
export type IssuedRecoveryLink = {
	token: string;
	expiresAt: Date;
	delivery: "queued" | "copy_only";
};

/** Inspect a bearer link without returning account details. */
export async function inspectRecoveryLink(
	db: Db,
	token: string,
	purpose: RecoveryPurpose,
): Promise<"usable" | "unusable"> {
	const [row] = await db
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			emailVerified: users.emailVerified,
			lifecycleState: users.lifecycleState,
		})
		.from(setupTokens)
		.innerJoin(users, eq(users.id, setupTokens.userId))
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, purpose),
				isNull(setupTokens.consumedAt),
				isNull(setupTokens.supersededAt),
				sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
			),
		)
		.limit(1);
	return row?.active &&
		row.authMigratedAt &&
		row.lifecycleState === "normal" &&
		(purpose !== "password_recovery" || row.emailVerified)
		? "usable"
		: "unusable";
}

/** Issue a recovery link, optionally queuing mail in the same transaction. */
export async function issueRecoveryLink(
	db: Db,
	input: IssueRecoveryLinkInput,
): Promise<IssuedRecoveryLink> {
	return db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, input.userId);
		const [user] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
				email: users.email,
				emailVerified: users.emailVerified,
				handle: users.handle,
				administratorRole: users.administratorRole,
				lifecycleState: users.lifecycleState,
			})
			.from(users)
			.where(eq(users.id, input.userId))
			.for("update")
			.limit(1);
		const [credential] = await tx
			.select({ id: authAccounts.id })
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.userId, input.userId),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				),
			)
			.limit(1);
		if (
			!user?.active ||
			!user.authMigratedAt ||
			user.lifecycleState !== "normal" ||
			!credential
		) {
			throw new RecoveryNotEligibleError();
		}
		if (
			input.purpose === "administrator_recovery" &&
			user.administratorRole !== null &&
			input.issuerUserId !== undefined
		) {
			const [issuer] = await tx
				.select({ administratorRole: users.administratorRole })
				.from(users)
				.where(eq(users.id, input.issuerUserId))
				.limit(1);
			if (issuer?.administratorRole !== "full") {
				throw new RecoveryNotEligibleError();
			}
		}
		const canEmail =
			input.deliveryAvailable && user.emailVerified && user.email !== "";
		if (input.purpose === "password_recovery" && !canEmail) {
			throw new RecoveryNotEligibleError();
		}
		const issued = await issueSetupTokenInTransaction(tx, {
			userId: input.userId,
			purpose: input.purpose,
			lifetimeMs: canEmail
				? EMAILED_RECOVERY_LIFETIME_MS
				: RECOVERY_LIFETIME_MS,
		});
		if (!canEmail) {
			return {
				token: issued.token,
				expiresAt: issued.expiresAt,
				delivery: "copy_only" as const,
			};
		}
		const queued = await enqueueEmail(tx, {
			idempotencyKey: `${input.purpose}/${input.userId}/${issued.tokenId}`,
			recipient: user.email,
			template: {
				type: "password_recovery",
				username: user.handle,
				recoveryUrl: input.getRecoveryUrl(issued.token),
			},
		});
		if (queued.status !== "queued") {
			if (input.purpose === "password_recovery") {
				throw new RecoveryDeliveryUnavailableError();
			}
			return {
				token: issued.token,
				expiresAt: issued.expiresAt,
				delivery: "copy_only" as const,
			};
		}
		return {
			token: issued.token,
			expiresAt: issued.expiresAt,
			delivery: "queued" as const,
		};
	});
}

/** Resolve a handle to an eligible verified-email recovery target. */
export async function getSelfServiceRecoveryTarget(
	db: Db,
	handle: string,
): Promise<number | null> {
	const [row] = await db
		.select({ id: users.id })
		.from(users)
		.innerJoin(authAccounts, eq(authAccounts.userId, users.id))
		.where(
			and(
				sql`lower(${users.handle}) = ${handle.trim().toLowerCase()}`,
				eq(users.active, true),
				eq(users.lifecycleState, "normal"),
				eq(users.emailVerified, true),
				sql`${users.authMigratedAt} is not null`,
				eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
			),
		)
		.limit(1);
	return row?.id ?? null;
}

/** Revoke outstanding administrator recovery links for one account. */
export async function revokeAdministratorRecoveryLinks(
	db: Db,
	userId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		await tx
			.update(setupTokens)
			.set({ supersededAt: sql`timezone('utc', now())` })
			.where(
				and(
					eq(setupTokens.userId, userId),
					eq(setupTokens.purpose, "administrator_recovery"),
					sql`${setupTokens.consumedAt} is null and ${setupTokens.supersededAt} is null`,
				),
			);
	});
}

/** Change a password and revoke all browser and setup authority atomically. */
export async function completePasswordRecovery(
	db: Db,
	token: string,
	purpose: RecoveryPurpose,
	password: string,
): Promise<number> {
	if ((await inspectRecoveryLink(db, token, purpose)) === "unusable") {
		throw new SetupCredentialError();
	}
	const hashed = await hashPassword(password);
	const userId = await db.transaction(async (tx) => {
		const [target] = await tx
			.select({ userId: setupTokens.userId })
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.tokenHash, hashToken(token)),
					eq(setupTokens.purpose, purpose),
				),
			)
			.limit(1);
		if (!target) {
			throw new SetupCredentialError();
		}
		await lockUserSetupCredentials(tx, target.userId);
		const consumed = await consumeSetupToken(tx, token, purpose);
		const [user] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
				emailVerified: users.emailVerified,
				lifecycleState: users.lifecycleState,
				password: users.password,
			})
			.from(users)
			.where(eq(users.id, consumed.userId))
			.for("update")
			.limit(1);
		const [credential] = await tx
			.select({ password: authAccounts.password })
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.userId, consumed.userId),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				),
			)
			.limit(1);
		if (
			!user?.active ||
			!user.authMigratedAt ||
			user.lifecycleState !== "normal" ||
			(purpose === "password_recovery" && !user.emailVerified) ||
			!credential?.password
		) {
			throw new SetupCredentialError();
		}
		if (
			await verifyPassword(password, Buffer.from(credential.password, "utf8"))
		) {
			throw new RecoveryPasswordReuseError();
		}
		await tx
			.update(authAccounts)
			.set({ password: hashed.toString("utf8"), updatedAt: new Date() })
			.where(
				and(
					eq(authAccounts.userId, consumed.userId),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				),
			);
		await tx
			.update(users)
			.set({
				password: hashed,
				lastPasswordChange: new Date(),
				forceReset: false,
			})
			.where(eq(users.id, consumed.userId));
		await tx
			.delete(authSessions)
			.where(eq(authSessions.userId, consumed.userId));
		await tx.delete(sessions).where(eq(sessions.userId, consumed.userId));
		await tx
			.delete(setupSessions)
			.where(eq(setupSessions.userId, consumed.userId));
		await invalidateUserSetupTokens(tx, consumed.userId);
		return consumed.userId;
	});
	await emit("users", userId, "update");
	return userId;
}
