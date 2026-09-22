import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { authSessions } from "../db/schema/auth";
import { type SessionRow, sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { nowUtc } from "../db/time";
import { hashToken, newSessionId, newSessionToken } from "./tokens";

const SESSION_LIFETIME_MS = 60 * 60 * 1000;
const RESET_LIFETIME_MS = 10 * 60 * 1000;

/** A live Better Auth session resolved with the database clock. */
export type ResolvedBrowserSession = {
	sessionId: number;
	userId: number;
	createdAt: Date;
	forceReset: boolean;
};

/** A live Better Auth session row safe for account-session display shaping. */
export type ActiveBrowserSessionRow = {
	id: number;
	browser: string;
	operatingSystem: string;
	ipAddress: string | null;
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
};

/** List one user's live Better Auth sessions with the current row first. */
export async function findActiveBrowserSessions(
	db: DbOrTx,
	userId: number,
	currentSessionId: number,
): Promise<ActiveBrowserSessionRow[]> {
	return db
		.select({
			id: authSessions.id,
			browser: authSessions.browser,
			operatingSystem: authSessions.operatingSystem,
			ipAddress: authSessions.ipAddress,
			createdAt: authSessions.createdAt,
			updatedAt: authSessions.updatedAt,
			expiresAt: authSessions.expiresAt,
		})
		.from(authSessions)
		.where(
			and(
				eq(authSessions.userId, userId),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
			),
		)
		.orderBy(
			desc(sql`${authSessions.id} = ${currentSessionId}`),
			desc(authSessions.updatedAt),
			desc(authSessions.id),
		);
}

/** Delete a user's selected live session, returning whether it was present. */
export async function deleteActiveBrowserSession(
	db: DbOrTx,
	userId: number,
	managementId: number,
): Promise<boolean> {
	const deleted = await db
		.delete(authSessions)
		.where(
			and(
				eq(authSessions.id, managementId),
				eq(authSessions.userId, userId),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
			),
		)
		.returning({ id: authSessions.id });
	return deleted.length === 1;
}

/** Delete every Better Auth session for a user except the current row. */
export async function deleteOtherBrowserSessions(
	db: DbOrTx,
	userId: number,
	currentSessionId: number,
): Promise<number> {
	const deleted = await db
		.delete(authSessions)
		.where(
			and(
				eq(authSessions.userId, userId),
				ne(authSessions.id, currentSessionId),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
				or(
					isNull(authSessions.replacementForSessionId),
					ne(authSessions.replacementForSessionId, currentSessionId),
				),
			),
		)
		.returning({ id: authSessions.id });
	return deleted.length;
}

/** Lock and resolve the authoritative current session for a revocation transaction. */
export async function resolveBrowserSessionForUpdate(
	db: DbOrTx,
	sessionId: number,
	userId: number,
): Promise<ResolvedBrowserSession | null> {
	const [row] = await db
		.select({
			sessionId: authSessions.id,
			userId: authSessions.userId,
			createdAt: authSessions.createdAt,
			forceReset: users.forceReset,
		})
		.from(authSessions)
		.innerJoin(users, eq(users.id, authSessions.userId))
		.where(
			and(
				eq(authSessions.id, sessionId),
				eq(authSessions.userId, userId),
				eq(users.active, true),
				eq(users.lifecycleState, "normal"),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
			),
		)
		.limit(1)
		.for("update");

	return row ?? null;
}

/** Resolve a live Better Auth session and its active user authoritatively. */
export async function resolveBrowserSession(
	db: DbOrTx,
	sessionId: number,
	userId: number,
): Promise<ResolvedBrowserSession | null> {
	const [row] = await db
		.select({
			sessionId: authSessions.id,
			userId: authSessions.userId,
			createdAt: authSessions.createdAt,
			forceReset: users.forceReset,
		})
		.from(authSessions)
		.innerJoin(users, eq(users.id, authSessions.userId))
		.where(
			and(
				eq(authSessions.id, sessionId),
				eq(authSessions.userId, userId),
				eq(users.active, true),
				eq(users.lifecycleState, "normal"),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
			),
		)
		.limit(1);

	return row ?? null;
}

/** Inputs to mint a temporary legacy authenticated session. */
export type CreateAuthenticatedSessionInput = {
	userId: number;
	ip: string;
};

/** A temporary legacy authenticated session and its plaintext cookie values. */
export type CreateAuthenticatedSessionResult = {
	sessionId: string;
	token: string;
	row: SessionRow;
};

/** Mint a one-hour legacy session during the staged authentication cutover. */
export async function createAuthenticatedSession(
	db: DbOrTx,
	{ userId, ip }: CreateAuthenticatedSessionInput,
): Promise<CreateAuthenticatedSessionResult> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const now = new Date();
	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
				tokenHash: hashToken(token),
				sessionType: "authenticated",
			})
			.returning(),
	);

	return { sessionId, token, row };
}

/** Inputs to mint a temporary legacy forced-reset session. */
export type CreateResetSessionInput = {
	userId: number;
	ip: string;
};

/** A temporary legacy reset session and its plaintext cookie token. */
export type CreateResetSessionResult = {
	sessionId: string;
	token: string;
	row: SessionRow;
};

/** Mint a legacy reset session during the staged authentication cutover. */
export async function createResetSession(
	db: DbOrTx,
	{ userId, ip }: CreateResetSessionInput,
): Promise<CreateResetSessionResult> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const now = new Date();
	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS),
				tokenHash: hashToken(token),
				sessionType: "reset",
			})
			.returning(),
	);

	return { sessionId, token, row };
}

/** Invalidate one retained legacy browser session. */
export async function invalidateSession(
	db: DbOrTx,
	sessionId: string,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

/** Invalidate every retained legacy browser session for a user. */
export async function invalidateUserSessions(
	db: DbOrTx,
	userId: number,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Atomically consume a retained legacy forced-reset session. */
export async function consumeResetSession(
	db: DbOrTx,
	sessionId: string,
): Promise<boolean> {
	const deleted = await db
		.delete(sessions)
		.where(
			and(eq(sessions.sessionId, sessionId), eq(sessions.sessionType, "reset")),
		)
		.returning({ id: sessions.id });
	return deleted.length === 1;
}

/** Rows removed per statement so the sweep does not hold every row lock at once. */
const SESSION_CLEANUP_BATCH_SIZE = 2_000;

/** Options for deleting expired application sessions. */
export type DeleteExpiredSessionsOptions = {
	/** Rows removed per statement. */
	batchSize?: number;
	/** Aborts the loop between batches. */
	signal?: AbortSignal;
};

/**
 * Delete every expired Better Auth and retained legacy session.
 *
 * Each batch autocommits when `db` is a database handle, keeping the delete
 * from holding every expired row lock until the full sweep finishes. Postgres
 * supplies the cutoff because `expires_at` is a naive UTC timestamp and
 * binding a JavaScript `Date` would cast it through the connection time zone.
 *
 * The outer expiry check protects a session that Better Auth refreshes after
 * the subquery selects it but before the delete acquires its row lock.
 */
export async function deleteExpiredSessions(
	db: DbOrTx,
	{
		batchSize = SESSION_CLEANUP_BATCH_SIZE,
		signal,
	}: DeleteExpiredSessionsOptions = {},
): Promise<number> {
	if (!Number.isInteger(batchSize) || batchSize < 1) {
		throw new RangeError(
			`batchSize must be a positive integer, got ${batchSize}`,
		);
	}

	let total = 0;

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(authSessions)
			.where(
				sql`${authSessions.expiresAt} <= ${nowUtc()} and ${authSessions.id} in (
					select id from ${authSessions}
					where expires_at <= ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: authSessions.id });

		total += deleted.length;

		if (deleted.length < batchSize) {
			break;
		}
	}

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(sessions)
			.where(
				sql`${sessions.expiresAt} <= ${nowUtc()} and ${sessions.id} in (
					select id from ${sessions}
					where expires_at <= ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: sessions.id });

		total += deleted.length;
		if (deleted.length < batchSize) {
			return total;
		}
	}
}
