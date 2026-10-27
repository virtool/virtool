import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx, PgClient } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type DataMigrationFindingRow,
	type DataMigrationKind,
	type DataMigrationRow,
	dataMigrationFindings,
	dataMigrations,
} from "../db/schema/dataMigrations";
import { nowUtc } from "../db/time";

export type {
	DataMigrationFindingRow,
	DataMigrationKind,
	DataMigrationRow,
	DataMigrationStatus,
} from "../db/schema/dataMigrations";

/** A finding whose subject and detail must contain no secrets. */
export type DataMigrationFinding = {
	code: string;
	subject?: string;
	detail?: Record<string, unknown>;
};

// Keep this key stable so every migration process contends on the same lock.
const LOCK_KEY = "virtool:data_migrations";

/**
 * Take the framework's session-level advisory lock, or report that another
 * process holds it.
 *
 * Session-level rather than transaction-scoped: a run spans many transactions —
 * one per batch — and a lock released at the first commit would serialize
 * nothing. It is released when {@link releaseDataMigrationsLock} is called or, if
 * the process dies, when Postgres reaps the backend, which is what lets the
 * next run take over a row left in `running`.
 *
 * Pass the raw client, not a Drizzle handle. The lock lives on one backend, so
 * it must be taken and released on the same connection, and this is only sound
 * against a pool of one with connection rotation disabled. Stop the runner if
 * that connection closes; reconnecting loses ownership.
 */
export async function acquireDataMigrationsLock(
	client: PgClient,
): Promise<boolean> {
	const rows = await client<{ locked: boolean }[]>`
		select pg_try_advisory_lock(hashtext(${LOCK_KEY})) as locked
	`;

	return rows[0]?.locked === true;
}

/** Release the lock {@link acquireDataMigrationsLock} took on this connection. */
export async function releaseDataMigrationsLock(
	client: PgClient,
): Promise<void> {
	await client`select pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
}

/**
 * Read the row recording what `key` at `version` did, if it has ever run.
 *
 * The version is part of the lookup rather than a field the caller compares
 * afterwards: a row for another version is not a weaker answer about this one,
 * it is an answer about something else.
 */
export async function getDataMigration(
	db: DbOrTx,
	key: string,
	version: number,
): Promise<DataMigrationRow | undefined> {
	return takeFirst(
		await db
			.select()
			.from(dataMigrations)
			.where(
				and(eq(dataMigrations.key, key), eq(dataMigrations.version, version)),
			),
	);
}

/** Every recorded data migration outcome, oldest key and version first. */
export async function listDataMigrations(
	db: DbOrTx,
): Promise<DataMigrationRow[]> {
	return db
		.select()
		.from(dataMigrations)
		.orderBy(asc(dataMigrations.key), asc(dataMigrations.version));
}

/** The findings a data migration recorded on its most recent attempt. */
export async function listDataMigrationFindings(
	db: DbOrTx,
	migrationId: number,
): Promise<DataMigrationFindingRow[]> {
	return db
		.select()
		.from(dataMigrationFindings)
		.where(eq(dataMigrationFindings.migrationId, migrationId))
		.orderBy(asc(dataMigrationFindings.id));
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
export async function startDataMigrationAttempt(
	db: Db,
	key: string,
	version: number,
	kind: DataMigrationKind,
): Promise<DataMigrationRow> {
	return db.transaction(async (tx) => {
		const row = takeFirstOrThrow(
			await tx
				.insert(dataMigrations)
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
					target: [dataMigrations.key, dataMigrations.version],
					set: {
						kind,
						status: "running",
						attempts: sql`${dataMigrations.attempts} + 1`,
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
			.delete(dataMigrationFindings)
			.where(eq(dataMigrationFindings.migrationId, row.id));

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
export async function recordDataMigrationFindings(
	db: DbOrTx,
	migrationId: number,
	findings: readonly DataMigrationFinding[],
): Promise<void> {
	if (findings.length === 0) {
		return;
	}

	await db.insert(dataMigrationFindings).values(
		findings.map((finding) => ({
			migrationId,
			code: finding.code,
			subject: finding.subject ?? null,
			detail: finding.detail ?? null,
		})),
	);
}

/** Persist a clean batch checkpoint after its writes have committed. */
export async function updateDataMigrationProgress(
	db: DbOrTx,
	migrationId: number,
	progress: Record<string, unknown>,
): Promise<void> {
	await db
		.update(dataMigrations)
		.set({ progress, updatedAt: nowUtc() })
		.where(eq(dataMigrations.id, migrationId));
}

/** How an attempt ended, as {@link finishDataMigration} records it. */
export type DataMigrationOutcome = {
	status: "passed" | "failed" | "errored";
	summary?: Record<string, unknown>;
	/** Already redacted by the caller. */
	error?: string;
};

/** Record the attempt outcome, clearing the checkpoint only after a pass. */
export async function finishDataMigration(
	db: DbOrTx,
	migrationId: number,
	outcome: DataMigrationOutcome,
): Promise<DataMigrationRow> {
	return takeFirstOrThrow(
		await db
			.update(dataMigrations)
			.set({
				status: outcome.status,
				summary: outcome.summary ?? null,
				error: outcome.error ?? null,
				...(outcome.status === "passed" && { progress: null }),
				finishedAt: nowUtc(),
				updatedAt: nowUtc(),
			})
			.where(eq(dataMigrations.id, migrationId))
			.returning(),
	);
}
