// Mirror of the `indexes` and `index_files` tables managed by the upstream
// Python service via Alembic. Do not generate or push migrations from this side.
// Keep in sync with `../../../../../../virtool/virtool/indexes/sql.py`.
//
// Both tables are written from here — starting a build inserts the `indexes`
// row and the `create_index` task registers the artifact it produces — so every
// column the real tables require is declared, the legacy `index` string column
// on `index_files` included.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
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

export const indexFiles = pgTable(
	"index_files",
	{
		id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
		name: text("name").notNull(),
		// The owning build's id as a string, predating `index_id` and dropped by a
		// later cleanup revision. Nullable, so nothing has to fill it, but Python
		// writes `str(index_id)` and this side writes the same — a row is then
		// identical whichever runner built it.
		index: text("index"),
		index_id: bigint("index_id", { mode: "number" }).notNull(),
		type: indexType("type"),
		size: bigint("size", { mode: "number" }),
		// The file's complete object-storage key, superseding the per-index
		// `indexes.storage_key` slug keys were previously composed from.
		storage_key: text("storage_key").unique().notNull(),
	},
	(table) => [
		// `index_files_index_id_name_key`. Declared because a build's registration
		// of its artifact upserts on it, and an `ON CONFLICT` naming columns no
		// constraint covers is an error rather than an insert.
		unique("index_files_index_id_name_key").on(table.index_id, table.name),
	],
);

/** A row from the `indexes` table. */
export type IndexRow = typeof indexes.$inferSelect;

/** A row from the `index_files` table. */
export type IndexFileRow = typeof indexFiles.$inferSelect;
