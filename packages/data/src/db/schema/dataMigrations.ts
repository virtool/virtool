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

/** A read-only audit or a resumable backfill. */
export type DataMigrationKind = "audit" | "backfill";

/** The latest attempt state; running does not imply the lock is still held. */
export type DataMigrationStatus = "running" | "passed" | "failed" | "errored";

/** The SQL fragment closing the `kind` column to the shared union. */
function kindCheck(): SQL {
	return sql.raw("kind in ('audit', 'backfill')");
}

/** The SQL fragment closing the `status` column to the shared union. */
function statusCheck(): SQL {
	return sql.raw("status in ('running', 'passed', 'failed', 'errored')");
}

export const dataMigrations = pgTable(
	"data_migrations",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		/** The stable identifier shared by a body and its SQL assertion. */
		key: text("key").notNull(),
		/**
		 * The implementation version this row is the outcome for. A gate is
		 * satisfied only by a passing row carrying the version the registry
		 * currently declares.
		 */
		version: integer("version").notNull(),
		kind: text("kind").$type<DataMigrationKind>().notNull(),
		status: text("status").$type<DataMigrationStatus>().notNull(),
		/** How many attempts this `(key, version)` has taken, including the last. */
		attempts: integer("attempts").notNull().default(0),
		/**
		 * The resume point, written after each clean backfill batch commits.
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
		unique("data_migrations_key_version_key").on(table.key, table.version),
		index("idx_data_migrations_key").on(table.key),
		check("data_migrations_kind_valid", kindCheck()),
		check("data_migrations_status_valid", statusCheck()),
	],
);

/** A row from the `data_migrations` table. */
export type DataMigrationRow = typeof dataMigrations.$inferSelect;

export const dataMigrationFindings = pgTable(
	"data_migration_findings",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		migrationId: integer("migration_id").notNull(),
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
			columns: [table.migrationId],
			foreignColumns: [dataMigrations.id],
			name: "data_migration_findings_migration_id_fkey",
		}).onDelete("cascade"),
		// Findings are only ever read, cleared and counted per data migration.
		index("idx_data_migration_findings_migration_id").on(table.migrationId),
	],
);

/** A row from the `data_migration_findings` table. */
export type DataMigrationFindingRow = typeof dataMigrationFindings.$inferSelect;
