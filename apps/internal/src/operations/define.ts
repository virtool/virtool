/**
 * The authoring surface every database operation is written against.
 *
 * An operation is work that has to happen to the data before a schema change
 * is safe, and that a `.sql` file cannot express: it needs to read a whole
 * table without holding it, to write in bounded batches it can resume, or to
 * report what it objected to in a form an operator can act on. The framework
 * records what an operation concluded; the migration runner refuses to apply a
 * migration that declares it until it has concluded well.
 *
 * A body is framework-free. It receives a database handle, a logger, an abort
 * signal and a way to report findings, and it touches none of the framework's
 * own tables.
 *
 * **A body may run more than once for the same `(key, version)`.** An attempt
 * that is interrupted leaves whatever it had already committed in place, and
 * the retry resumes from the last persisted cursor — which is at or before the
 * last committed batch, never after it. Every batch must therefore be
 * idempotent.
 */

import type { Db } from "@virtool/data/db/pg";
import type { DatabaseOperationFinding } from "@virtool/data/operations/data";
import type { Logger } from "@virtool/logger";
import type { z } from "zod";

/**
 * Record a problem against the running attempt.
 *
 * Returns nothing: findings are buffered and written in batches, so a body
 * that reports per row does not pay a round trip per row. Reporting anything
 * at all makes the attempt `failed` — an operation that finds a problem has not
 * passed, whichever kind it is.
 *
 * `detail` is stored verbatim. Put no credential, token or hash in it.
 */
export type FindingReporter = (finding: DatabaseOperationFinding) => void;

/** What every operation body receives. */
export type OperationArgs = {
	db: Db;
	logger: Logger;
	/** Aborted when the process is shutting down. Long loops must observe it. */
	signal: AbortSignal;
	report: FindingReporter;
};

/**
 * A read-only check, as its author writes it. Construct with
 * {@link defineAudit}.
 *
 * It passes when it reports nothing. It must not write: the point of running
 * one ahead of a migration is to learn whether the migration is safe, and a
 * check that changes what it is checking cannot be re-run to confirm a
 * remediation worked.
 */
export type AuditDefinition = {
	key: string;
	kind: "audit";
	/** Bump whenever the check changes what it accepts. */
	version: number;
	/** One line, shown by the `operations list` subcommand. */
	description: string;
	run: (args: OperationArgs) => Promise<void>;
};

/** What a data migration's batch function receives. */
export type BatchArgs<C> = OperationArgs & {
	/** Where the last persisted batch left off. */
	cursor: C;
	/** The most records this batch may touch. */
	batchSize: number;
};

/** What a batch reports back. Return `null` when nothing is left to do. */
export type BatchResult<C> = {
	/** The resume point, persisted before the next batch starts. */
	cursor: C;
	/** How many records this batch committed. */
	processed: number;
};

/**
 * A mutating, resumable migration, as its author writes it. Construct with
 * {@link defineDataMigration}.
 *
 * `runBatch` owns its own transactions and decides what atomicity a record
 * needs. The framework persists the cursor it returns *after* it returns, so a
 * process killed between a commit and that write resumes from before the batch
 * it had already committed — see this module's documentation.
 */
export type DataMigrationDefinition<C> = {
	key: string;
	kind: "data_migration";
	version: number;
	description: string;
	/** Passed to `runBatch` and bounded by whatever the body can hold. */
	batchSize: number;
	/**
	 * Parses the persisted cursor. A cursor that no longer parses — because the
	 * implementation was patched and its shape moved — is discarded for
	 * `initialCursor`, which is safe exactly because batches are idempotent.
	 */
	cursor: z.ZodType<C>;
	/** Where an attempt with nothing persisted starts. */
	initialCursor: C;
	runBatch: (args: BatchArgs<C>) => Promise<BatchResult<C> | null>;
};

/**
 * An operation with its cursor type erased, as a registry holds it.
 *
 * A registry maps keys to operations whose cursors have nothing in common, so
 * the type it stores cannot name any one of them. {@link defineDataMigration}
 * performs the erasure once, keeping the cast out of every body and out of the
 * executor.
 */
export type RegisteredOperation =
	| AuditDefinition
	| DataMigrationDefinition<unknown>;

/** Every operation the framework knows how to run, keyed by its stable key. */
export type OperationRegistry = Record<string, RegisteredOperation>;

/**
 * Register an audit.
 *
 * Identity at run time. It exists so a definition is checked against the type
 * at the point it is written rather than where it is collected.
 */
export function defineAudit(definition: AuditDefinition): AuditDefinition {
	return definition;
}

/**
 * Register a data migration.
 *
 * Identity at run time — it exists for the inference, giving `runBatch` a
 * cursor narrowed by `cursor` without an annotation, and for the erasure that
 * lets one registry hold every operation.
 *
 * The erasure is sound because the only caller of `runBatch` parses `cursor`
 * first and passes what it produced: the executor never hands a body a value
 * the body's own schema has not accepted.
 */
export function defineDataMigration<C>(
	definition: DataMigrationDefinition<C>,
): RegisteredOperation {
	return definition as RegisteredOperation;
}
