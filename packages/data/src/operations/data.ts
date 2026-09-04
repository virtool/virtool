import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx, PgClient } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type DatabaseOperationFindingRow,
	type DatabaseOperationKind,
	type DatabaseOperationRow,
	databaseOperationFindings,
	databaseOperations,
} from "../db/schema/operations";
import { nowUtc } from "../db/time";

export type {
	DatabaseOperationFindingRow,
	DatabaseOperationKind,
	DatabaseOperationRow,
	DatabaseOperationStatus,
} from "../db/schema/operations";

/**
 * A problem an operation found and wants recorded.
 *
 * `detail` is written verbatim into `jsonb`, so an implementation must put
 * nothing secret in it — see {@link recordOperationFindings}.
 */
export type DatabaseOperationFinding = {
	code: string;
	subject?: string;
	detail?: Record<string, unknown>;
};

/**
 * The lock every operation run and every gated migration apply is serialized
 * on.
 *
 * One lock for the whole framework rather than one per key. Operations are
 * ordered against each other by the migrations that gate them, they are rare,
 * and each is minutes at most, so nothing is gained by letting two of them
 * interleave — while a single lock also stops a migration from being applied
 * underneath an operation that is still deciding whether it may be.
 */
const LOCK_KEY = "virtool:database_operations";

/**
 * Take the framework's session-level advisory lock, or report that another
 * process holds it.
 *
 * Session-level rather than transaction-scoped: a run spans many transactions —
 * one per batch — and a lock released at the first commit would serialize
 * nothing. It is released when {@link releaseOperationsLock} is called or, if
 * the process dies, when Postgres reaps the backend, which is what lets the
 * next run take over a row left in `running`.
 *
 * Pass the raw client, not a Drizzle handle. The lock lives on one backend, so
 * it must be taken and released on the same connection, and this is only sound
 * against a pool of one.
 */
export async function acquireOperationsLock(
	client: PgClient,
): Promise<boolean> {
	const rows = await client<{ locked: boolean }[]>`
		select pg_try_advisory_lock(hashtext(${LOCK_KEY})) as locked
	`;

	return rows[0]?.locked === true;
}

/** Release the lock {@link acquireOperationsLock} took on this connection. */
export async function releaseOperationsLock(client: PgClient): Promise<void> {
	await client`select pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
}

/**
 * Read the row recording what `key` at `version` did, if it has ever run.
 *
 * The version is part of the lookup rather than a field the caller compares
 * afterwards: a row for another version is not a weaker answer about this one,
 * it is an answer about something else.
 */
export async function getOperation(
	db: DbOrTx,
	key: string,
	version: number,
): Promise<DatabaseOperationRow | undefined> {
	return takeFirst(
		await db
			.select()
			.from(databaseOperations)
			.where(
				and(
					eq(databaseOperations.key, key),
					eq(databaseOperations.version, version),
				),
			),
	);
}

/**
 * Every recorded outcome for `key`, oldest version first.
 *
 * The gate reads this when it finds no row for the version it wants, to tell a
 * key that has never run from one whose implementation has moved on since it
 * last did.
 */
export async function listOperationVersions(
	db: DbOrTx,
	key: string,
): Promise<DatabaseOperationRow[]> {
	return db
		.select()
		.from(databaseOperations)
		.where(eq(databaseOperations.key, key))
		.orderBy(asc(databaseOperations.version));
}

/** Every recorded operation outcome, oldest key and version first. */
export async function listOperations(
	db: DbOrTx,
): Promise<DatabaseOperationRow[]> {
	return db
		.select()
		.from(databaseOperations)
		.orderBy(asc(databaseOperations.key), asc(databaseOperations.version));
}

/** The findings an operation recorded on its most recent attempt. */
export async function listOperationFindings(
	db: DbOrTx,
	operationId: number,
): Promise<DatabaseOperationFindingRow[]> {
	return db
		.select()
		.from(databaseOperationFindings)
		.where(eq(databaseOperationFindings.operationId, operationId))
		.orderBy(asc(databaseOperationFindings.id));
}

/**
 * Open an attempt for `key` at `version` and return the row it will be
 * recorded on.
 *
 * Creates the row on the first attempt and reuses it afterwards, bumping
 * `attempts` and clearing the previous outcome. The findings of the previous
 * attempt are deleted here rather than merged: an attempt reports what it
 * found, and findings a remediated database no longer produces must not
 * survive into the run that proves they are gone.
 *
 * `progress` is deliberately left alone. It is the resume point, and a retry of
 * an interrupted data migration continues from it.
 */
export async function startOperationAttempt(
	db: Db,
	key: string,
	version: number,
	kind: DatabaseOperationKind,
): Promise<DatabaseOperationRow> {
	return db.transaction(async (tx) => {
		const row = takeFirstOrThrow(
			await tx
				.insert(databaseOperations)
				.values({
					key,
					version,
					kind,
					status: "running",
					attempts: 1,
					startedAt: nowUtc(),
					updatedAt: nowUtc(),
				})
				.onConflictDoUpdate({
					target: [databaseOperations.key, databaseOperations.version],
					set: {
						kind,
						status: "running",
						attempts: sql`${databaseOperations.attempts} + 1`,
						error: null,
						summary: null,
						startedAt: nowUtc(),
						finishedAt: null,
						updatedAt: nowUtc(),
					},
				})
				.returning(),
		);

		await tx
			.delete(databaseOperationFindings)
			.where(eq(databaseOperationFindings.operationId, row.id));

		return row;
	});
}

/**
 * Append findings to the current attempt.
 *
 * Called repeatedly as an audit reads, so a long audit does not hold every
 * finding it has produced in memory. Nothing here inspects `detail`; keeping
 * credentials, tokens and hashes out of it is the implementation's job, and the
 * executor's redaction covers only the error path.
 */
export async function recordOperationFindings(
	db: DbOrTx,
	operationId: number,
	findings: readonly DatabaseOperationFinding[],
): Promise<void> {
	if (findings.length === 0) {
		return;
	}

	await db.insert(databaseOperationFindings).values(
		findings.map((finding) => ({
			operationId,
			code: finding.code,
			subject: finding.subject ?? null,
			detail: finding.detail ?? null,
		})),
	);
}

/**
 * Write the resume point a data migration reached.
 *
 * Its own statement, outside whatever transaction the batch committed in. A
 * cursor written inside the batch would be rolled back with it, and a cursor
 * that survives a batch that did not is the safe direction to be wrong in only
 * if the body is idempotent — which is why the framework requires that of
 * every body rather than of some.
 */
export async function updateOperationProgress(
	db: DbOrTx,
	operationId: number,
	progress: Record<string, unknown>,
): Promise<void> {
	await db
		.update(databaseOperations)
		.set({ progress, updatedAt: nowUtc() })
		.where(eq(databaseOperations.id, operationId));
}

/** How an attempt ended, as {@link finishOperation} records it. */
export type OperationOutcome = {
	status: "passed" | "failed" | "errored";
	summary?: Record<string, unknown>;
	/** Already redacted by the caller. */
	error?: string;
};

/**
 * Close the current attempt with its outcome.
 *
 * A passing data migration clears `progress`: the resume point described an
 * unfinished run, and leaving it would have the next attempt of a later version
 * start from a cursor that version never wrote.
 */
export async function finishOperation(
	db: DbOrTx,
	operationId: number,
	outcome: OperationOutcome,
): Promise<DatabaseOperationRow> {
	return takeFirstOrThrow(
		await db
			.update(databaseOperations)
			.set({
				status: outcome.status,
				summary: outcome.summary ?? null,
				error: outcome.error ?? null,
				...(outcome.status === "passed" && { progress: null }),
				finishedAt: nowUtc(),
				updatedAt: nowUtc(),
			})
			.where(eq(databaseOperations.id, operationId))
			.returning(),
	);
}
