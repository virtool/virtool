import type { ActiveBrowserSession, PasskeySummary } from "@virtool/contracts";
import {
	deletePasskey,
	lockPasskeyOwner,
	renamePasskey,
} from "@virtool/data/auth/passkeys";
import {
	deleteActiveBrowserSession,
	deleteOtherBrowserSessions,
	findActiveBrowserSessions,
	resolveBrowserSessionForUpdate,
} from "@virtool/data/auth/session";
import type { Db, DbOrTx } from "@virtool/data/db/pg";
import { isSessionFresh } from "../auth/freshness";
import {
	getBrowserSessionDisplay,
	normalizeSessionIpAddress,
} from "../auth/sessionMetadata";

/** The current session ended while a session-management operation was running. */
export class BrowserSessionEndedError extends Error {}

/** The current session became stale while a revocation operation was running. */
export class BrowserSessionNotFreshError extends Error {}

/** A selected revocation tried to address the caller's current session. */
export class CurrentBrowserSessionError extends Error {}

/** List the current user's live browser sessions without exposing bearer tokens. */
export async function getActiveBrowserSessions(
	db: Db,
	userId: number,
	currentSessionId: number,
): Promise<ActiveBrowserSession[]> {
	const rows = await findActiveBrowserSessions(db, userId, currentSessionId);
	if (!rows.some((row) => row.id === currentSessionId)) {
		throw new BrowserSessionEndedError();
	}

	return rows.map((row) => {
		const display = getBrowserSessionDisplay(row.userAgent);

		return {
			managementId: row.id,
			...display,
			ipAddress: normalizeSessionIpAddress(row.ipAddress),
			createdAt: row.createdAt,
			lastActivityAt: row.updatedAt,
			expiresAt: row.expiresAt,
			isCurrent: row.id === currentSessionId,
		};
	});
}

async function checkCurrentSession(
	db: DbOrTx,
	userId: number,
	currentSessionId: number,
): Promise<void> {
	const current = await resolveBrowserSessionForUpdate(
		db,
		currentSessionId,
		userId,
	);
	if (!current) {
		throw new BrowserSessionEndedError();
	}
	if (!isSessionFresh(current.createdAt)) {
		throw new BrowserSessionNotFreshError();
	}
}

/** Revoke a selected non-current browser session under the user's session lock. */
export async function revokeActiveBrowserSession(
	db: Db,
	userId: number,
	currentSessionId: number,
	managementId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await checkCurrentSession(tx, userId, currentSessionId);
		if (managementId === currentSessionId) {
			throw new CurrentBrowserSessionError();
		}
		await deleteActiveBrowserSession(tx, userId, managementId);
	});
}

/** Revoke every browser session other than the transaction-verified current one. */
export async function revokeOtherActiveBrowserSessions(
	db: Db,
	userId: number,
	currentSessionId: number,
): Promise<number> {
	return db.transaction(async (tx) => {
		await checkCurrentSession(tx, userId, currentSessionId);
		return deleteOtherBrowserSessions(tx, userId, currentSessionId);
	});
}

/** No passkey with the management id belongs to the current user. */
export class PasskeyNotFoundError extends Error {}

/** Rename one of the user's passkeys while the current session is still fresh. */
export async function renameAccountPasskey(
	db: Db,
	userId: number,
	currentSessionId: number,
	managementId: number,
	name: string,
): Promise<PasskeySummary> {
	return db.transaction(async (tx) => {
		await checkCurrentSession(tx, userId, currentSessionId);
		const passkey = await renamePasskey(tx, userId, managementId, name);
		if (!passkey) {
			throw new PasskeyNotFoundError();
		}
		return passkey;
	});
}

/**
 * Remove one of the user's passkeys while the current session is still fresh.
 *
 * Removing a passkey that is already gone succeeds, so a retried request does
 * not report an error for work that was done. Another user's passkey is
 * indistinguishable from a missing one and is never touched.
 */
export async function removeAccountPasskey(
	db: Db,
	userId: number,
	currentSessionId: number,
	managementId: number,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockPasskeyOwner(tx, userId);
		await checkCurrentSession(tx, userId, currentSessionId);
		await deletePasskey(tx, userId, managementId);
	});
}
