// Schema for the gated database operations framework.
//
// An operation is an audit or a data migration that runs beside the Drizzle
// migration chain rather than inside it: a `.sql` file cannot batch, cannot
// resume, and cannot report which rows it objected to. The two tables here are
// what the migration runner reads to decide whether a gated migration may be
// applied, so they are the durable record — logs are not consulted.
//
// A row is keyed by `(key, version)` rather than by `key` alone. Patching an
// implementation bumps its version, and the new version has no row until it
// runs, which is what makes an outstanding pass go stale instead of silently
// standing in for work the patched implementation has not done.

import { type SQL, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

/**
 * What an operation does to the database.
 *
 * An `audit` only reads: it passes when it finds nothing to report. A
 * `data_migration` writes, in bounded batches, and passes when it runs to
 * completion.
 */
export type DatabaseOperationKind = "audit" | "data_migration";

/**
 * Where an operation attempt got to.
 *
 * `failed` and `errored` are held apart because they call for different
 * responses. A `failed` operation reached its own conclusion: the data is not
 * what it requires, and an operator has remediation to do. An `errored`
 * operation reached no conclusion at all — the connection dropped, a table was
 * missing, the implementation threw — and says nothing about the data.
 *
 * `running` is written before the body starts and is not evidence that a body
 * is running now: a process killed mid-attempt leaves it behind. The run lock
 * is the only proof of liveness.
 */
export type DatabaseOperationStatus =
	| "running"
	| "passed"
	| "failed"
	| "errored";

/** The SQL fragment closing the `kind` column to the shared union. */
function kindCheck(): SQL {
	return sql.raw("kind in ('audit', 'data_migration')");
}

/** The SQL fragment closing the `status` column to the shared union. */
function statusCheck(): SQL {
	return sql.raw("status in ('running', 'passed', 'failed', 'errored')");
}

export const databaseOperations = pgTable(
	"database_operations",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		/** The stable identifier an implementation and a gate both name. */
		key: text("key").notNull(),
		/**
		 * The implementation version this row is the outcome for. A gate is
		 * satisfied only by a passing row carrying the version the registry
		 * currently declares.
		 */
		version: integer("version").notNull(),
		kind: text("kind").$type<DatabaseOperationKind>().notNull(),
		status: text("status").$type<DatabaseOperationStatus>().notNull(),
		/** How many attempts this `(key, version)` has taken, including the last. */
		attempts: integer("attempts").notNull().default(0),
		/**
		 * The resume point, written after every batch a data migration commits.
		 * Null for an audit, which reads and holds nothing.
		 */
		progress: jsonb("progress"),
		/** The machine-readable outcome the export path serves. */
		summary: jsonb("summary"),
		/** The redacted message of the error that ended an `errored` attempt. */
		error: text("error"),
		startedAt: timestamp("started_at"),
		finishedAt: timestamp("finished_at"),
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		updatedAt: timestamp("updated_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
	},
	(table) => [
		// One row per implementation version. The gate looks a row up by exactly
		// this pair, and a duplicate would be two outcomes for one attemptable
		// thing.
		unique("database_operations_key_version_key").on(table.key, table.version),
		// The listing and the gate's own lookup both start from the key.
		index("idx_database_operations_key").on(table.key),
		check("database_operations_kind_valid", kindCheck()),
		check("database_operations_status_valid", statusCheck()),
	],
);

/** A row from the `database_operations` table. */
export type DatabaseOperationRow = typeof databaseOperations.$inferSelect;

export const databaseOperationFindings = pgTable(
	"database_operation_findings",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		operationId: integer("operation_id").notNull(),
		/** What kind of problem this is, stable enough to group and count on. */
		code: text("code").notNull(),
		/** What the finding is about — a row identifier, a handle, an address. */
		subject: text("subject"),
		/** Structured detail, carrying no secret and no credential material. */
		detail: jsonb("detail"),
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
	},
	(table) => [
		foreignKey({
			columns: [table.operationId],
			foreignColumns: [databaseOperations.id],
			name: "database_operation_findings_operation_id_fkey",
		}).onDelete("cascade"),
		// Findings are only ever read, cleared and counted per operation.
		index("idx_database_operation_findings_operation_id").on(table.operationId),
	],
);

/** A row from the `database_operation_findings` table. */
export type DatabaseOperationFindingRow =
	typeof databaseOperationFindings.$inferSelect;
