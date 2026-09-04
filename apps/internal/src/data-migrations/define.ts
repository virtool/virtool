import type { DataMigrationFinding } from "@virtool/data/data-migrations/data";
import type { PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import type { z } from "zod";

/** A reporter whose findings fail the attempt; details must contain no secrets. */
export type FindingReporter = (finding: DataMigrationFinding) => void;

/** The historical database connection and services available to a migration body. */
export type DataMigrationArgs = {
	client: PgClient;
	logger: Logger;
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

/** A read-only migration that passes when it reports no findings. */
export type AuditDefinition = Definition & {
	kind: "audit";
	run: (args: DataMigrationArgs) => Promise<void>;
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

/** An idempotent backfill whose clean batches are checkpointed after they return. */
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

export function defineAudit(definition: AuditDefinition): AuditDefinition {
	return definition;
}

export function defineBackfill<C>(
	definition: BackfillDefinition<C>,
): RegisteredDataMigration {
	// The executor parses the cursor with this definition before passing it back.
	return definition as RegisteredDataMigration;
}
