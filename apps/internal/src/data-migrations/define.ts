import type { DataMigrationFinding } from "@virtool/data/data-migrations/data";
import type { PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import type { z } from "zod";

/**
 * A reporter whose findings fail the attempt.
 *
 * Details are stored verbatim and sent to Sentry, so they must contain no
 * secrets.
 */
export type FindingReporter = (finding: DataMigrationFinding) => void;

/**
 * The historical database connection and services available to a migration body.
 *
 * A body runs at an old position in the schema chain, so the current schema can
 * name columns that don't exist yet. Use SQL pinned to that position, or table
 * definitions frozen next to the body. Don't write the framework's own tables.
 */
export type DataMigrationArgs = {
	client: PgClient;
	logger: Logger;
	/** Observe this in a long body. A body that ignores it delays shutdown. */
	signal: AbortSignal;
	report: FindingReporter;
};

/** The identity and SQL boundary of a data migration. */
type Definition = {
	key: string;
	version: number;
	migrationTag: string;
	description: string;
};

/** A full scan with retry-safe repairs that passes when it reports no findings. */
export type AuditDefinition = Definition & {
	kind: "audit";
	run: (
		args: DataMigrationArgs,
	) => Promise<Record<string, unknown> | undefined>;
};

/** The checkpoint and maximum batch size passed to a backfill. */
export type BatchArgs<C> = DataMigrationArgs & {
	cursor: C;
	batchSize: number;
};

/** A committed batch's checkpoint and number of processed records. */
export type BatchResult<C> = {
	cursor: C;
	processed: number;
};

/**
 * An idempotent backfill whose clean batches are checkpointed after they return.
 *
 * Each batch must tolerate replay: a crash after its writes commit and before
 * its checkpoint persists repeats those writes.
 */
export type BackfillDefinition<C> = Definition & {
	kind: "backfill";
	batchSize: number;
	cursor: z.ZodType<C>;
	initialCursor: C;
	/** Return null when complete; a batch with findings is replayed on retry. */
	runBatch: (args: BatchArgs<C>) => Promise<BatchResult<C> | null>;
};

/** A registered audit or backfill with its cursor type erased. */
export type RegisteredDataMigration =
	| AuditDefinition
	| BackfillDefinition<unknown>;

/** Data migration implementations indexed by stable key, independent of execution order. */
export type DataMigrationRegistry = Record<string, RegisteredDataMigration>;

/**
 * Declare an audit.
 *
 * `migrationTag` is the exact journal tag of the SQL migration that the audit
 * runs before. Bump `version` and the paired SQL assertion together when the
 * body changes what it accepts or writes. A pair that has been applied doesn't
 * run again, so a change for those databases needs a new pair.
 */
export function defineAudit(definition: AuditDefinition): AuditDefinition {
	return definition;
}

/**
 * Declare a backfill. Version and pairing work as in {@link defineAudit}.
 *
 * The body owns its transactions and returns its cursor after a batch commits.
 */
export function defineBackfill<C>(
	definition: BackfillDefinition<C>,
): RegisteredDataMigration {
	// The executor parses the cursor with this definition before passing it back.
	return definition as RegisteredDataMigration;
}
