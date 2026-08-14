// Mirror of the `indexes` and `index_files` tables managed by the upstream
// Python service via Alembic. Do not generate or push migrations from this side.
// Keep in sync with `../../../../../../virtool/virtool/indexes/sql.py`.
//
// Both tables are written from here — starting a build inserts the `indexes`
// row and the `create_index` task registers the artifact it produces — so every
// column the real tables require is declared, the legacy `index` string column
// on `index_files` included.

import type { IndexFileType } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";
import { legacyReferences } from "./references";
import { tasks } from "./tasks";
import { users } from "./users";

export const indexes = pgTable(
	"indexes",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
		version: integer("version").notNull(),
		created_at: timestamp("created_at").notNull(),
		// `{otuId: otuVersion}` — the OTU versions the build is pinned to, captured
		// when the build starts.
		manifest: jsonb("manifest").$type<Record<string, number>>().notNull(),
		ready: boolean("ready")
			.$defaultFn(() => false)
			.notNull(),
		// Dead. Keys were once composed as `indexes/{storage_key}/{file name}`; each
		// file now records its own complete key. Python retains the column until a
		// later cleanup revision so a rolling deploy never has readers of a dropped
		// column, and still requires it on insert.
		storage_key: text("storage_key").notNull(),
		// The exception to files recording their own keys. The compressed OTU JSON is
		// materialized on demand and deliberately has no `index_files` row, because
		// such a row would publish it in the index's file listing. Nullable: an index
		// that has never been asked for its OTU JSON has not written one, and the key
		// is minted on first write.
		otus_json_storage_key: text("otus_json_storage_key"),
		reference_id: bigint("reference_id", { mode: "number" })
			.notNull()
			.references(() => legacyReferences.id),
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
		// A build is backed by at most one of these: `job_id` for a legacy
		// workflow-run build, `task_id` for one started from either service today.
		job_id: integer("job_id").references(() => jobs.id),
		task_id: integer("task_id").references(() => tasks.id),
	},
	(table) => [
		unique("indexes_legacy_id_key").on(table.legacy_id),
		unique("indexes_storage_key_key").on(table.storage_key),
		unique("uq_indexes_otus_json_storage_key").on(table.otus_json_storage_key),
		unique("uq_indexes_reference_id_version").on(
			table.reference_id,
			table.version,
		),
		check(
			"ck_indexes_job_or_task",
			sql`num_nonnulls(${table.job_id}, ${table.task_id}) <= 1`,
		),
	],
);

export const indexFiles = pgTable(
	"index_files",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		// The owning build's id as a string, predating `index_id` and dropped by a
		// later cleanup revision. Nullable, so nothing has to fill it, but Python
		// writes `str(index_id)` and this side writes the same — a row is then
		// identical whichever runner built it.
		index: text("index"),
		index_id: bigint("index_id", { mode: "number" })
			.notNull()
			.references(() => indexes.id, { onDelete: "cascade" }),
		type: text("type").$type<IndexFileType>(),
		size: bigint("size", { mode: "number" }),
		// The file's complete object-storage key, superseding the per-index
		// `indexes.storage_key` slug keys were previously composed from.
		storage_key: text("storage_key").notNull(),
	},
	(table) => [
		unique("uq_index_files_storage_key").on(table.storage_key),
		// `index_files_index_id_name_key`. Declared because a build's registration
		// of its artifact upserts on it, and an `ON CONFLICT` naming columns no
		// constraint covers is an error rather than an insert.
		unique("index_files_index_id_name_key").on(table.index_id, table.name),
		check(
			"ck_index_files_type",
			sql`${table.type} in ('json', 'fasta', 'bowtie2', 'sqlite')`,
		),
	],
);

/** A row from the `indexes` table. */
export type IndexRow = typeof indexes.$inferSelect;

/** A row from the `index_files` table. */
export type IndexFileRow = typeof indexFiles.$inferSelect;
