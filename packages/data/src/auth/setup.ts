import { randomBytes } from "node:crypto";

import type { RestrictedSetup, SetupPurpose } from "@virtool/contracts";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	type SetupSessionRow,
	setupSessions,
	setupTokens,
} from "../db/schema/setup";
import { users } from "../db/schema/users";
import { nowUtc } from "../db/time";
import { AppError } from "../errors";
import { hashToken } from "./tokens";

/** How long a setup link stays usable. */
const SETUP_TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000;

/** How long a restricted setup session stays usable. */
const SETUP_SESSION_LIFETIME_MS = 30 * 60 * 1000;

/** The prefix every restricted setup session id carries. */
const SETUP_SESSION_ID_PREFIX = "setup_";

/**
 * Thrown when a setup token cannot be used.
 *
 * Deliberately carries no reason. Unknown, expired, already spent, presented
 * for the wrong purpose, and belonging to a deactivated account are one
 * answer, because telling them apart tells the holder whether a given token
 * exists.
 */
export class SetupCredentialError extends AppError {}

/** What {@link issueSetupToken} accepts. */
export type IssueSetupTokenInput = {
	userId: number;
	purpose: SetupPurpose;
	/** Defaults to {@link SETUP_TOKEN_LIFETIME_MS}. */
	lifetimeMs?: number;
};

/**
 * A freshly issued setup token: the plaintext to put in a link, and the
 * non-secret facts a caller may show or store.
 *
 * `token` is the only time the plaintext exists outside the holder's link. It
 * is not written to the row, not logged, and not readable back.
 */
export type IssuedSetupToken = {
	token: string;
	userId: number;
	purpose: SetupPurpose;
	expiresAt: Date;
};

/**
 * Issue a setup token, superseding any the user already holds for the same
 * purpose.
 *
 * Superseding is what makes "send a new link" safe: the previous link stops
 * working the moment the replacement is minted, so a forwarded or intercepted
 * older mail is inert. Consumed rows are left alone — they are the record that
 * the transition already happened, and cleanup removes them once they expire.
 *
 * Both statements run in one transaction, so a caller can never end up with
 * two live tokens for a purpose.
 */
export async function issueSetupToken(
	db: Db,
	{
		userId,
		purpose,
		lifetimeMs = SETUP_TOKEN_LIFETIME_MS,
	}: IssueSetupTokenInput,
): Promise<IssuedSetupToken> {
	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + lifetimeMs);

	await db.transaction(async (tx) => {
		await supersedeSetupTokens(tx, userId, purpose);

		await tx.insert(setupTokens).values({
			userId,
			purpose,
			tokenHash: hashToken(token),
			expiresAt,
		});
	});

	return { token, userId, purpose, expiresAt };
}

/**
 * Delete every unspent setup token a user holds for `purpose`, and report how
 * many went.
 *
 * Deleted rather than flagged: a superseded link and an unknown one have to be
 * indistinguishable to whoever submits them, and the simplest way to say
 * nothing is to have nothing to say.
 */
export async function supersedeSetupTokens(
	db: DbOrTx,
	userId: number,
	purpose: SetupPurpose,
): Promise<number> {
	const deleted = await db
		.delete(setupTokens)
		.where(
			and(
				eq(setupTokens.userId, userId),
				eq(setupTokens.purpose, purpose),
				isNull(setupTokens.consumedAt),
			),
		)
		.returning({ id: setupTokens.id });

	return deleted.length;
}

/** The user a consumed setup token names. */
export type ConsumedSetupToken = {
	userId: number;
	purpose: SetupPurpose;
};

/**
 * Spend a setup token for `purpose`, or throw {@link SetupCredentialError}.
 *
 * **Call this inside the transaction that performs the transition it
 * authorizes.** The consumption and the transition are one unit: a token spent
 * against a transition that then rolls back is a link the holder can no longer
 * use for an account that never changed.
 *
 * Consumption is a single conditional `UPDATE ... RETURNING`, so two
 * submissions of one token serialize on the row and exactly one sees a row
 * come back. The loser is told the same thing every other refusal says.
 *
 * The expiry test uses Postgres's clock rather than a `Date` bound from here:
 * `expires_at` is `timestamp without time zone` holding naive UTC, and a
 * JavaScript `Date` compared against it casts through the session `TimeZone`,
 * which this pool leaves unset.
 *
 * `users.active` is re-read here rather than trusted from issuance.
 * Deactivation is authoritative and immediate — an administrator who switches
 * an account off has revoked its setup link too.
 */
export async function consumeSetupToken(
	db: DbOrTx,
	token: string,
	purpose: SetupPurpose,
): Promise<ConsumedSetupToken> {
	const [row] = await db
		.update(setupTokens)
		.set({ consumedAt: sql`${nowUtc()}` })
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, purpose),
				isNull(setupTokens.consumedAt),
				sql`${setupTokens.expiresAt} > ${nowUtc()}`,
				sql`exists (select 1 from ${users} where ${users.id} = ${setupTokens.userId} and ${users.active})`,
			),
		)
		.returning({ userId: setupTokens.userId, purpose: setupTokens.purpose });

	if (!row) {
		throw new SetupCredentialError();
	}

	return row;
}

/** What {@link createSetupSession} accepts. */
export type CreateSetupSessionInput = {
	userId: number;
	purpose: SetupPurpose;
	ip: string;
	/** Defaults to {@link SETUP_SESSION_LIFETIME_MS}. */
	lifetimeMs?: number;
};

/** A restricted setup session, and the secret the browser must send back. */
export type CreatedSetupSession = {
	/** The non-secret identifier, for attribution. */
	sessionId: string;
	/** The secret half. Only its digest is stored. */
	token: string;
	row: SetupSessionRow;
};

/**
 * Mint a restricted setup session for one purpose.
 *
 * Two values rather than one, mirroring the authenticated pair: `sessionId`
 * names the session in a log or a Sentry scope and proves nothing, and `token`
 * is the secret that does. Nothing but this function ever holds the plaintext.
 *
 * Every restricted session the user already holds goes first. A holder may be
 * part-way through exactly one setup at a time, and abandoning one flow has to
 * close it rather than leave a second door open.
 */
export async function createSetupSession(
	db: Db,
	{
		userId,
		purpose,
		ip,
		lifetimeMs = SETUP_SESSION_LIFETIME_MS,
	}: CreateSetupSessionInput,
): Promise<CreatedSetupSession> {
	const sessionId = SETUP_SESSION_ID_PREFIX + randomBytes(24).toString("hex");
	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + lifetimeMs);

	const row = await db.transaction(async (tx) => {
		await invalidateUserSetupSessions(tx, userId);

		return takeFirstOrThrow(
			await tx
				.insert(setupSessions)
				.values({
					sessionId,
					tokenHash: hashToken(token),
					userId,
					purpose,
					ip,
					expiresAt,
				})
				.returning(),
		);
	});

	return { sessionId, token, row };
}

/**
 * Resolve a restricted setup session from its cookie pair, or `null`.
 *
 * `null` for every non-fatal failure — missing values, unknown session,
 * expired, deactivated user, digest mismatch — so the boundary answers one
 * refusal without saying which check failed.
 *
 * What comes back is deliberately the whole of what the credential proves:
 * a user, a session id, one purpose and an expiry. No role, no group
 * permission and no API-key cap, because a restricted caller has none.
 *
 * The user's `active` flag is re-read on every request for the same reason the
 * authenticated path re-reads it: deactivation has to take effect at once, and
 * a setup credential must never be the looser door.
 */
export async function verifySetupSession(
	db: Db,
	sessionId: string | undefined,
	token: string | undefined,
): Promise<RestrictedSetup | null> {
	if (!sessionId || !token) {
		return null;
	}

	const [row] = await db
		.select({
			userId: setupSessions.userId,
			purpose: setupSessions.purpose,
			tokenHash: setupSessions.tokenHash,
			expiresAt: setupSessions.expiresAt,
			active: users.active,
		})
		.from(setupSessions)
		.innerJoin(users, eq(users.id, setupSessions.userId))
		.where(
			and(
				eq(setupSessions.sessionId, sessionId),
				eq(setupSessions.tokenHash, hashToken(token)),
			),
		)
		.limit(1);

	if (!row?.active || row.expiresAt.getTime() <= Date.now()) {
		return null;
	}

	return {
		userId: row.userId,
		sessionId,
		purpose: row.purpose,
		expiresAt: row.expiresAt,
	};
}

/** Delete one restricted setup session, by its non-secret identifier. */
export async function invalidateSetupSession(
	db: DbOrTx,
	sessionId: string,
): Promise<void> {
	await db.delete(setupSessions).where(eq(setupSessions.sessionId, sessionId));
}

/**
 * Delete every restricted setup session a user holds.
 *
 * Called when a setup transition commits and when one is abandoned, so a
 * completed or dropped flow leaves no credential behind.
 */
export async function invalidateUserSetupSessions(
	db: DbOrTx,
	userId: number,
): Promise<void> {
	await db.delete(setupSessions).where(eq(setupSessions.userId, userId));
}

/**
 * How many expired setup rows one statement removes.
 *
 * The same bound the session sweep uses, and for the same reason: short enough
 * that nothing waiting on a row waits long, large enough that the loop is not
 * itself the cost.
 */
const SETUP_CLEANUP_BATCH_SIZE = 2_000;

/** What the setup sweeps accept. */
export type DeleteExpiredSetupOptions = {
	/** Rows removed per statement. Defaults to {@link SETUP_CLEANUP_BATCH_SIZE}. */
	batchSize?: number;
	/** Aborts the loop between batches. Committed batches stand. */
	signal?: AbortSignal;
};

/** How many rows each sweep removed. */
export type DeleteExpiredSetupResult = {
	tokens: number;
	sessions: number;
};

/**
 * Delete every expired `setup_tokens` and `setup_sessions` row, and report how
 * many of each went.
 *
 * Batched, each batch its own transaction, and bounded by Postgres's clock —
 * the same shape as `deleteExpiredSessions`, for the same reasons, which are
 * written out in full there.
 *
 * Nothing waits on this. `consumeSetupToken` and `verifySetupSession` both
 * refuse an expired row on sight, so a row lingering between sweeps is inert
 * and a late sweep is harmless. That is what keeps the work on the runner's
 * schedule instead of in the request path.
 *
 * An expired *consumed* token goes too. Its only remaining job was to make a
 * replayed link fail the same way an unknown one does, and past its expiry the
 * expiry check does that on its own.
 */
export async function deleteExpiredSetupState(
	db: DbOrTx,
	{
		batchSize = SETUP_CLEANUP_BATCH_SIZE,
		signal,
	}: DeleteExpiredSetupOptions = {},
): Promise<DeleteExpiredSetupResult> {
	if (!Number.isInteger(batchSize) || batchSize < 1) {
		throw new RangeError(
			`batchSize must be a positive integer, got ${batchSize}`,
		);
	}

	return {
		tokens: await sweep(db, setupTokens, batchSize, signal),
		sessions: await sweep(db, setupSessions, batchSize, signal),
	};
}

/*
 The expiry test is repeated on the outer `delete`, where it looks redundant
 against the subquery that already applied it. Under Read Committed a row
 updated by a transaction that commits mid-statement is re-checked against the
 outer `where` alone — the subquery is not re-run — so a predicate naming only
 the id would pass on a row whose `expires_at` has since moved forward.
*/
async function sweep(
	db: DbOrTx,
	table: typeof setupTokens | typeof setupSessions,
	batchSize: number,
	signal: AbortSignal | undefined,
): Promise<number> {
	let total = 0;

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(table)
			.where(
				sql`${table.expiresAt} < ${nowUtc()} and ${table.id} in (
					select id from ${table}
					where expires_at < ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: table.id });

		total += deleted.length;

		if (deleted.length < batchSize) {
			return total;
		}
	}
}
