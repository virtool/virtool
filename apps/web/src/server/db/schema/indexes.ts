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
	// The object-storage prefix the build's files live under. A migrated index
	// keys on its Mongo id and a natively-created one on a minted UUID, so this
	// cannot be derived from `id` and must be persisted.
	storage_key: text("storage_key").unique().notNull(),
	reference_id: bigint("reference_id", { mode: "number" }).notNull(),
	user_id: integer("user_id").notNull(),
	// A build is backed by at most one of these: `job_id` for a legacy
	// workflow-run build, `task_id` for one started from either service today.
	job_id: integer("job_id"),
	task_id: integer("task_id"),
});

/** The kind of artifact an index file holds. */
export const indexType = pgEnum("indextype", ["json", "fasta", "bowtie2"]);

export const indexFiles = pgTable("index_files", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	name: text("name").notNull(),
	index_id: bigint("index_id", { mode: "number" }).notNull(),
	type: indexType("type"),
	size: bigint("size", { mode: "number" }),
});

/** A row from the `indexes` table. */
export type IndexRow = typeof indexes.$inferSelect;

/** A row from the `index_files` table. */
export type IndexFileRow = typeof indexFiles.$inferSelect;
