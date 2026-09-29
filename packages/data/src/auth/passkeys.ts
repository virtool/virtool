import type { PasskeySummary } from "@virtool/contracts";
import { DEFAULT_PASSKEY_NAME } from "@virtool/contracts";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import {
	type AuthPasskeyRow,
	authAccounts,
	authPasskeys,
} from "../db/schema/auth";
import { users } from "../db/schema/users";
import { CREDENTIAL_PROVIDER_ID } from "./credential";

/** The user has no password credential to fall back on. */
export class PasskeyFallbackMissingError extends Error {}

const summaryColumns = {
	id: authPasskeys.id,
	name: authPasskeys.name,
	createdAt: authPasskeys.createdAt,
	deviceType: authPasskeys.deviceType,
	backedUp: authPasskeys.backedUp,
};

type SummaryRow = Pick<
	AuthPasskeyRow,
	"id" | "name" | "createdAt" | "deviceType" | "backedUp"
>;

/** Map a stored passkey to the summary its owner sees. */
export function toPasskeySummary(row: SummaryRow): PasskeySummary {
	return {
		managementId: row.id,
		name: row.name || DEFAULT_PASSKEY_NAME,
		createdAt: row.createdAt,
		multiDevice: row.deviceType === "multiDevice",
		backedUp: row.backedUp,
	};
}

/** List a user's passkeys, oldest first, without credential material. */
export async function findPasskeys(
	db: DbOrTx,
	userId: number,
): Promise<PasskeySummary[]> {
	const rows = await db
		.select(summaryColumns)
		.from(authPasskeys)
		.where(eq(authPasskeys.userId, userId))
		.orderBy(
			sql`${authPasskeys.createdAt} asc nulls first`,
			asc(authPasskeys.id),
		);

	return rows.map(toPasskeySummary);
}

/** Whether any user already holds a credential with this WebAuthn id. */
export async function isPasskeyCredentialRegistered(
	db: DbOrTx,
	credentialId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: authPasskeys.id })
		.from(authPasskeys)
		.where(eq(authPasskeys.credentialID, credentialId))
		.limit(1);

	return row !== undefined;
}

/**
 * Rename one of a user's passkeys.
 *
 * Returns `null` when the passkey does not exist or belongs to someone else.
 */
export async function renamePasskey(
	db: DbOrTx,
	userId: number,
	managementId: number,
	name: string,
): Promise<PasskeySummary | null> {
	const [row] = await db
		.update(authPasskeys)
		.set({ name })
		.where(
			and(eq(authPasskeys.id, managementId), eq(authPasskeys.userId, userId)),
		)
		.returning(summaryColumns);

	return row ? toPasskeySummary(row) : null;
}

/**
 * Lock a user's row before a change to their passkeys.
 *
 * Take this lock before a lock on any of the user's sessions. Credential
 * resets lock the user and then delete the sessions, so the opposite order can
 * deadlock.
 *
 * Returns whether the user exists.
 */
export async function lockPasskeyOwner(
	tx: DbOrTx,
	userId: number,
): Promise<boolean> {
	const [owner] = await tx
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.for("update");

	return owner !== undefined;
}

/**
 * Delete one of a user's passkeys, leaving every other credential in place.
 *
 * Locks the user row first, so a concurrent password change or account
 * deactivation cannot interleave with the fallback check. Refuses when the user
 * has no password credential: a passkey is an optional credential beside the
 * password, and removing one must never leave the user without it.
 *
 * Returns whether a passkey was deleted. A missing passkey and another user's
 * passkey are indistinguishable.
 */
export async function deletePasskey(
	tx: DbOrTx,
	userId: number,
	managementId: number,
): Promise<boolean> {
	if (!(await lockPasskeyOwner(tx, userId))) {
		return false;
	}

	const [password] = await tx
		.select({ id: authAccounts.id })
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.userId, userId),
				eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				isNotNull(authAccounts.password),
			),
		)
		.limit(1);

	if (!password) {
		throw new PasskeyFallbackMissingError();
	}

	const deleted = await tx
		.delete(authPasskeys)
		.where(
			and(eq(authPasskeys.id, managementId), eq(authPasskeys.userId, userId)),
		)
		.returning({ id: authPasskeys.id });

	return deleted.length === 1;
}
