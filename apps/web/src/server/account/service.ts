import type { ActiveBrowserSession } from "@virtool/contracts";
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
