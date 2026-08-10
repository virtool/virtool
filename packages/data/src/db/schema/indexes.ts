// Mirror of the `indexes` and `index_files` tables managed by the upstream
// Python service via Alembic. Do not generate or push migrations from this side.
// Keep in sync with `../../../../../../virtool/virtool/indexes/sql.py`.
//
// `indexes` is written from here — starting a build inserts the row — so every
// column the real table requires is declared. `index_files` is read-only from
// this side: the Python `create_index` task writes it when a build finishes.
// Its legacy `index` string column is therefore deliberately not declared,
// following `history.ts`; nothing here inserts a row that would have to fill it.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const indexes = pgTable("indexes", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
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
	storage_key: text("storage_key").unique().notNull(),
	// The exception to files recording their own keys. The compressed OTU JSON is
	// materialized on demand and deliberately has no `index_files` row, because
	// such a row would publish it in the index's file listing. Nullable: an index
	// that has never been asked for its OTU JSON has not written one, and the key
	// is minted on first write.
	otus_json_storage_key: text("otus_json_storage_key").unique(),
	reference_id: bigint("reference_id", { mode: "number" }).notNull(),
	user_id: integer("user_id").notNull(),
	// A build is backed by at most one of these: `job_id` for a legacy
	// workflow-run build, `task_id` for one started from either service today.
	job_id: integer("job_id"),
	task_id: integer("task_id"),
});

/**
 * The kind of artifact an index file holds.
 *
 * Not a Postgres enum in the real schema. The `indextype` type was dropped
 * upstream and `index_files.type` is now `text` closed by the
 * `ck_index_files_type` CHECK constraint. The declaration is kept because the
 * values are right and nothing generates migrations from this side, so the
 * mismatch never reaches a real database.
 */
export const indexType = pgEnum("indextype", ["json", "fasta", "bowtie2"]);

export const indexFiles = pgTable("index_files", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	name: text("name").notNull(),
	index_id: bigint("index_id", { mode: "number" }).notNull(),
	type: indexType("type"),
	size: bigint("size", { mode: "number" }),
	// The file's complete object-storage key, superseding the per-index
	// `indexes.storage_key` slug keys were previously composed from.
	storage_key: text("storage_key").unique().notNull(),
});

/** A row from the `indexes` table. */
export type IndexRow = typeof indexes.$inferSelect;

/** A row from the `index_files` table. */
export type IndexFileRow = typeof indexFiles.$inferSelect;
