import type { BrowserSessionTiming } from "@virtool/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { authSessions } from "../db/schema/auth";
import { type SessionRow, sessions } from "../db/schema/sessions";
import { users } from "../db/schema/users";
import { nowUtc } from "../db/time";
import { hashToken, newSessionId, newSessionToken } from "./tokens";

const SESSION_LIFETIME_MS = 60 * 60 * 1000;
const RESET_LIFETIME_MS = 10 * 60 * 1000;

/** Validated durations governing normal Better Auth browser sessions. */
export type BrowserSessionTimingConfig = {
	idleLifetimeSeconds: number;
	absoluteLifetimeSeconds: number;
	minimumRefreshIntervalSeconds: number;
};

/** The timestamps assigned to a newly created browser session. */
export type NewBrowserSessionTiming = BrowserSessionTiming & {
	lastRefreshedAt: Date;
};

/** Derive every new-session clock from one database-authoritative instant. */
export async function createBrowserSessionTiming(
	db: DbOrTx,
	config: BrowserSessionTimingConfig,
): Promise<NewBrowserSessionTiming> {
	const [row] = await db.execute<{ now: string }>(
		sql`select ${nowUtc()} as "now"`,
	);
	if (!row) {
		throw new Error("failed to read the database clock");
	}

	const now = new Date(`${row.now}Z`);
	const absoluteExpiresAt = new Date(
		now.getTime() + config.absoluteLifetimeSeconds * 1_000,
	);
	const expiresAt = new Date(
		Math.min(
			now.getTime() + config.idleLifetimeSeconds * 1_000,
			absoluteExpiresAt.getTime(),
		),
	);

	return {
		lastActivityAt: now,
		expiresAt,
		absoluteExpiresAt,
		lastRefreshedAt: now,
	};
}

/** A live Better Auth session resolved with the database clock. */
export type ResolvedBrowserSession = BrowserSessionTiming & {
	sessionId: number;
	userId: number;
	forceReset: boolean;
};

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
			forceReset: users.forceReset,
			lastActivityAt: authSessions.lastActivityAt,
			expiresAt: authSessions.expiresAt,
			absoluteExpiresAt: authSessions.absoluteExpiresAt,
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
				sql`${authSessions.idleExpiresAt} > ${nowUtc()}`,
				sql`${authSessions.absoluteExpiresAt} > ${nowUtc()}`,
			),
		)
		.limit(1);

	return row ?? null;
}

/** Outcome of recording qualifying activity for a browser session. */
export type RefreshBrowserSessionActivityResult =
	| { status: "refreshed"; timing: BrowserSessionTiming }
	| { status: "not_due"; timing: BrowserSessionTiming }
	| { status: "no_longer_valid" };

/** Conditionally extend a live session's idle deadline without moving its cap. */
export async function refreshBrowserSessionActivity(
	db: DbOrTx,
	sessionId: number,
	userId: number,
	config: BrowserSessionTimingConfig,
): Promise<RefreshBrowserSessionActivityResult> {
	const [updated] = await db
		.update(authSessions)
		.set({
			expiresAt: sql`least(${nowUtc()} + make_interval(secs => ${config.idleLifetimeSeconds}::double precision), ${authSessions.absoluteExpiresAt})`,
			idleExpiresAt: sql`least(${nowUtc()} + make_interval(secs => ${config.idleLifetimeSeconds}::double precision), ${authSessions.absoluteExpiresAt})`,
			lastActivityAt: sql`${nowUtc()}`,
			lastRefreshedAt: sql`${nowUtc()}`,
			updatedAt: sql`${nowUtc()}`,
		})
		.where(
			and(
				eq(authSessions.id, sessionId),
				eq(authSessions.userId, userId),
				sql`${authSessions.expiresAt} > ${nowUtc()}`,
				sql`${authSessions.idleExpiresAt} > ${nowUtc()}`,
				sql`${authSessions.absoluteExpiresAt} > ${nowUtc()}`,
				sql`${authSessions.lastRefreshedAt} <= ${nowUtc()} - make_interval(secs => ${config.minimumRefreshIntervalSeconds}::double precision)`,
				sql`exists (
					select 1 from ${users}
					where ${users.id} = ${authSessions.userId}
						and ${users.active} = true
						and ${users.lifecycleState} = 'normal'
				)`,
			),
		)
		.returning({
			lastActivityAt: authSessions.lastActivityAt,
			expiresAt: authSessions.expiresAt,
			absoluteExpiresAt: authSessions.absoluteExpiresAt,
		});

	if (updated) {
		return { status: "refreshed", timing: updated };
	}

	const current = await resolveBrowserSession(db, sessionId, userId);
	if (!current) {
		return { status: "no_longer_valid" };
	}

	return {
		status: "not_due",
		timing: {
			lastActivityAt: current.lastActivityAt,
			expiresAt: current.expiresAt,
			absoluteExpiresAt: current.absoluteExpiresAt,
		},
	};
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
				sql`(${authSessions.expiresAt} <= ${nowUtc()} or ${authSessions.idleExpiresAt} <= ${nowUtc()} or ${authSessions.absoluteExpiresAt} <= ${nowUtc()}) and ${authSessions.id} in (
					select id from ${authSessions}
					where expires_at <= ${nowUtc()} or idle_expires_at <= ${nowUtc()} or absolute_expires_at <= ${nowUtc()}
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
