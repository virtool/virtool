import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authPasskeys } from "../db/schema/auth";

/** The stored public parts of a passkey that verify an assertion. */
type PasskeyCredential = {
	id: number;
	credentialID: string;
	publicKey: string;
	counter: number;
	transports: string | null;
};

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

/** Whether the user has registered at least one passkey. */
export async function hasPasskey(db: DbOrTx, userId: number): Promise<boolean> {
	const [row] = await db
		.select({ id: authPasskeys.id })
		.from(authPasskeys)
		.where(eq(authPasskeys.userId, userId))
		.limit(1);

	return row !== undefined;
}

/** Get the credential ids and transports of every passkey the user holds. */
export async function getPasskeyCredentialIds(
	db: DbOrTx,
	userId: number,
): Promise<{ credentialID: string; transports: string | null }[]> {
	return db
		.select({
			credentialID: authPasskeys.credentialID,
			transports: authPasskeys.transports,
		})
		.from(authPasskeys)
		.where(eq(authPasskeys.userId, userId));
}

/**
 * Get one passkey by its WebAuthn credential id, only when the user holds it.
 */
export async function getUserPasskey(
	db: DbOrTx,
	userId: number,
	credentialId: string,
): Promise<PasskeyCredential | undefined> {
	const [row] = await db
		.select({
			id: authPasskeys.id,
			credentialID: authPasskeys.credentialID,
			publicKey: authPasskeys.publicKey,
			counter: authPasskeys.counter,
			transports: authPasskeys.transports,
		})
		.from(authPasskeys)
		.where(
			and(
				eq(authPasskeys.credentialID, credentialId),
				eq(authPasskeys.userId, userId),
			),
		)
		.limit(1);

	return row;
}

/** Store the signature counter an authenticator reported for a passkey. */
export async function setPasskeyCounter(
	db: DbOrTx,
	id: number,
	counter: number,
): Promise<void> {
	await db.update(authPasskeys).set({ counter }).where(eq(authPasskeys.id, id));
}
