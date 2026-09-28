import {
	type AdministratorRoleName,
	type CreatedInvitation,
	INVITATION_LIFETIME_HOURS,
	type Invitation,
	type InvitationDelivery,
} from "@virtool/contracts";
import { and, desc, eq, max } from "drizzle-orm";
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
import { enqueueEmail } from "../email/outbox";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import {
	createPendingUserInTransaction,
	getUser,
	UserConflictError,
	UserNotFoundError,
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
	if (requestedEmail) {
		const queued = await enqueueEmail(tx, {
			idempotencyKey: `account_setup/${user.id}/${generation}`,
			recipient: user.email,
			setupTokenId: issued.tokenId,
			template: {
				type: "account_setup",
				username: "there",
				setupUrl: options.getSetupUrl(issued.token),
			},
		});
		if (queued.status === "queued") {
			delivery = "queued";
		}
	}

	await tx
		.update(setupTokens)
		.set({ delivery })
		.where(eq(setupTokens.id, issued.tokenId));

	return { ...issued, delivery };
}

function toInvitation(row: {
	id: number;
	userId: number;
	email: string;
	issuerUserId: number | null;
	generation: number;
	createdAt: Date;
	expiresAt: Date;
	consumedAt: Date | null;
	supersededAt: Date | null;
	delivery: "copy_only" | "queued" | null;
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
	email: users.email,
	issuerUserId: setupTokens.issuerUserId,
	generation: setupTokens.generation,
	createdAt: setupTokens.createdAt,
	expiresAt: setupTokens.expiresAt,
	consumedAt: setupTokens.consumedAt,
	supersededAt: setupTokens.supersededAt,
	delivery: setupTokens.delivery,
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
					handle: "",
					email: normalizeEmail(input.email),
				},
				1,
				input,
			);
			return { userId, issued };
		});

		await emit("users", result.userId, "create");
		const [user, invitation] = await Promise.all([
			getUser(db, result.userId),
			getInvitation(db, result.userId),
		]);
		return {
			user,
			invitation,
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
		.innerJoin(users, eq(users.id, setupTokens.userId))
		.leftJoin(emailOutbox, eq(emailOutbox.setup_token_id, setupTokens.id))
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

	const [user, invitation] = await Promise.all([
		getUser(db, userId),
		getInvitation(db, userId),
	]);
	return {
		user,
		invitation,
		setupToken: issued.delivery === "copy_only" ? issued.token : null,
	};
}

/** Delete a pending user and, through cascades, every invitation it holds. */
export async function deletePendingUser(db: Db, userId: number): Promise<void> {
	await db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, userId);
		const [user] = await tx
			.select({ lifecycleState: users.lifecycleState })
			.from(users)
			.where(eq(users.id, userId))
			.for("update")
			.limit(1);
		if (!user) {
			throw new UserNotFoundError();
		}
		if (user.lifecycleState !== "pending") {
			throw new InvitationNotEligibleError();
		}
		await tx.delete(users).where(eq(users.id, userId));
	});
	await emit("users", userId, "delete");
}
