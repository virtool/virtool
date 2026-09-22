import {
	type AdministratorRoleName,
	type CreatedInvitation,
	INVITATION_LIFETIME_HOURS,
	type Invitation,
	type InvitationDelivery,
} from "@virtool/contracts";
import { and, desc, eq, isNull, max } from "drizzle-orm";
import type { PostgresError } from "postgres";
import { normalizeEmail } from "../auth/email";
import {
	issueSetupTokenInTransaction,
	lockUserSetupCredentials,
} from "../auth/setup";
import type { Db, DbOrTx } from "../db/pg";
import { emailOutbox } from "../db/schema/emailOutbox";
import { setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { nowUtc } from "../db/time";
import { enqueueEmail } from "../email/outbox";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import {
	createPendingUserInTransaction,
	getUser,
	UserConflictError,
} from "./data";

/** An invitation operation targeted a user that is not pending and active. */
export class InvitationNotEligibleError extends AppError {}

/** No invitation metadata exists for the requested pending user. */
export class InvitationNotFoundError extends AppError {}

/** Inputs shared by invitation creation and regeneration. */
export type InvitationIssueOptions = {
	issuerUserId: number;
	deliveryIntent: "copy_only" | "email";
	deliveryAvailable: boolean;
	getSetupUrl: (token: string) => string;
};

/** Inputs for atomically creating a pending account and its first invitation. */
export type CreatePendingInvitationInput = InvitationIssueOptions & {
	handle: string;
	email: string;
	administratorRole?: AdministratorRoleName | null;
	groups?: number[];
	primaryGroup?: number | null;
};

function isUniqueViolation(error: unknown): boolean {
	if (error === null || typeof error !== "object") {
		return false;
	}
	const cause = (error as { cause?: unknown }).cause;
	return (
		(error as Partial<PostgresError>).code === "23505" ||
		(cause !== null &&
			typeof cause === "object" &&
			(cause as Partial<PostgresError>).code === "23505")
	);
}

async function issueInvitationInTransaction(
	tx: DbOrTx,
	user: { id: number; handle: string; email: string },
	generation: number,
	options: InvitationIssueOptions,
): Promise<{
	token: string;
	tokenId: number;
	expiresAt: Date;
	delivery: InvitationDelivery;
	outboxId: number | null;
}> {
	const requestedEmail =
		options.deliveryIntent === "email" && options.deliveryAvailable;
	const issued = await issueSetupTokenInTransaction(tx, {
		userId: user.id,
		purpose: "account_completion",
		candidateEmail: user.email,
		issuerUserId: options.issuerUserId,
		generation,
		delivery: requestedEmail ? "queued" : "copy_only",
		lifetimeMs: INVITATION_LIFETIME_HOURS * 60 * 60 * 1000,
	});

	let delivery: InvitationDelivery = "copy_only";
	let outboxId: number | null = null;
	if (requestedEmail) {
		const queued = await enqueueEmail(tx, {
			idempotencyKey: `account_setup/${user.id}/${generation}`,
			recipient: user.email,
			template: {
				type: "account_setup",
				username: user.handle,
				setupUrl: options.getSetupUrl(issued.token),
			},
		});
		if (queued.status === "queued") {
			delivery = "queued";
			outboxId = queued.outboxId;
		}
	}

	await tx
		.update(setupTokens)
		.set({ delivery, outboxId })
		.where(eq(setupTokens.id, issued.tokenId));

	return { ...issued, delivery, outboxId };
}

function toInvitation(row: {
	id: number;
	userId: number;
	issuerUserId: number | null;
	generation: number;
	createdAt: Date;
	expiresAt: Date;
	consumedAt: Date | null;
	revokedAt: Date | null;
	supersededAt: Date | null;
	delivery: "copy_only" | "queued" | null;
	outboxId: number | null;
	outboxStatus: "queued" | "accepted" | "failed" | null;
}): Invitation {
	if (row.issuerUserId === null || row.delivery === null) {
		throw new InvitationNotFoundError();
	}
	return { ...row, issuerUserId: row.issuerUserId, delivery: row.delivery };
}

const invitationSelection = {
	id: setupTokens.id,
	userId: setupTokens.userId,
	issuerUserId: setupTokens.issuerUserId,
	generation: setupTokens.generation,
	createdAt: setupTokens.createdAt,
	expiresAt: setupTokens.expiresAt,
	consumedAt: setupTokens.consumedAt,
	revokedAt: setupTokens.revokedAt,
	supersededAt: setupTokens.supersededAt,
	delivery: setupTokens.delivery,
	outboxId: setupTokens.outboxId,
	outboxStatus: emailOutbox.status,
};

/** Create a pending account, identity, invitation, and optional mail atomically. */
export async function createPendingInvitation(
	db: Db,
	input: CreatePendingInvitationInput,
): Promise<CreatedInvitation> {
	try {
		const result = await db.transaction(async (tx) => {
			const userId = await createPendingUserInTransaction(tx, input);
			const issued = await issueInvitationInTransaction(
				tx,
				{
					id: userId,
					handle: input.handle,
					email: normalizeEmail(input.email),
				},
				1,
				input,
			);
			return { userId, issued };
		});

		await emit("users", result.userId, "create");
		return {
			user: await getUser(db, result.userId),
			invitation: await getInvitation(db, result.userId),
			setupToken:
				result.issued.delivery === "copy_only" ? result.issued.token : null,
		};
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new UserConflictError();
		}
		throw error;
	}
}

/** Read the newest invitation generation without exposing its bearer token. */
export async function getInvitation(
	db: Db,
	userId: number,
): Promise<Invitation> {
	const [row] = await db
		.select(invitationSelection)
		.from(setupTokens)
		.leftJoin(emailOutbox, eq(emailOutbox.id, setupTokens.outboxId))
		.where(
			and(
				eq(setupTokens.userId, userId),
				eq(setupTokens.purpose, "account_completion"),
			),
		)
		.orderBy(desc(setupTokens.generation))
		.limit(1);
	if (!row) {
		throw new InvitationNotFoundError();
	}
	return toInvitation(row);
}

/** Revoke the current link and mint a new one, returning its secret once. */
export async function regenerateInvitation(
	db: Db,
	userId: number,
	options: InvitationIssueOptions,
): Promise<CreatedInvitation> {
	const issued = await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		const [user] = await tx
			.select({
				id: users.id,
				handle: users.handle,
				email: users.email,
				active: users.active,
				lifecycleState: users.lifecycleState,
			})
			.from(users)
			.where(eq(users.id, userId))
			.for("update")
			.limit(1);
		if (!user?.active || user.lifecycleState !== "pending") {
			throw new InvitationNotEligibleError();
		}
		const [current] = await tx
			.select({ generation: max(setupTokens.generation) })
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.userId, userId),
					eq(setupTokens.purpose, "account_completion"),
				),
			);
		return issueInvitationInTransaction(
			tx,
			user,
			(current?.generation ?? 0) + 1,
			options,
		);
	});

	return {
		user: await getUser(db, userId),
		invitation: await getInvitation(db, userId),
		setupToken: issued.delivery === "copy_only" ? issued.token : null,
	};
}

/** Explicitly revoke every live account-completion link for a pending user. */
export async function revokeInvitation(
	db: Db,
	userId: number,
): Promise<Invitation> {
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		const [user] = await tx
			.select({ active: users.active, lifecycleState: users.lifecycleState })
			.from(users)
			.where(eq(users.id, userId))
			.for("update")
			.limit(1);
		if (user?.lifecycleState !== "pending") {
			throw new InvitationNotEligibleError();
		}
		const revoked = await tx
			.update(setupTokens)
			.set({ revokedAt: nowUtc() })
			.where(
				and(
					eq(setupTokens.userId, userId),
					eq(setupTokens.purpose, "account_completion"),
					isNull(setupTokens.consumedAt),
					isNull(setupTokens.supersededAt),
					isNull(setupTokens.revokedAt),
				),
			)
			.returning({ id: setupTokens.id });
		if (revoked.length === 0) {
			throw new InvitationNotFoundError();
		}
	});
	return getInvitation(db, userId);
}
