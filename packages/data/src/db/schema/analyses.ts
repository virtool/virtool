// Read-only mirror of the `analyses` table and its join / file tables, managed
// by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/analyses/sql.py` and
// `../../../../../../virtool/virtool/blast/sql.py`.
//
// Python's `analysis_results` / `SQLAnalysisResult` table is deliberately not
// mirrored: its own docstring calls it temporary and nothing reads it.
//
// The legacy `sample` / `reference` / `index` string columns are likewise not
// mirrored. They are the Mongo-era half of a string+FK column pair that Python
// drops in a later cleanup revision; only the integer foreign key is read here.

import {
	bigint,
	boolean,
	integer,
	json,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const analyses = pgTable("analyses", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
	created_at: timestamp("created_at").notNull(),
	updated_at: timestamp("updated_at").notNull(),
	workflow: text("workflow").notNull(),
	ready: boolean("ready").notNull(),
	// The workflow's raw output, written by the jobs API. Opaque here: its
	// internals are the worker's contract, not this server's.
	results: jsonb("results").$type<Record<string, unknown>>(),
	// The legacy `sample` string column is still written by Python and is needed
	// to locate a migrated analysis's slug-prefixed objects in storage.
	sample: text("sample").notNull(),
	sample_id: bigint("sample_id", { mode: "number" }),
	reference_id: bigint("reference_id", { mode: "number" }),
	index_id: bigint("index_id", { mode: "number" }),
	user_id: integer("user_id").notNull(),
	job_id: integer("job_id"),
});

// Association between an analysis and a subtraction it was run against.
export const analysisSubtractions = pgTable("analysis_subtractions", {
	analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
	subtraction_id: bigint("subtraction_id", { mode: "number" }).notNull(),
});

// Result files retained by a workflow and offered for download. Written only by
// the jobs API, which is out of scope here — this side reads them.
export const analysisFiles = pgTable("analysis_files", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
	description: text("description"),
	// A real Postgres enum (`analysisformat`) upstream. Read as text: this side
	// never writes the column, and the enumerated values are the worker's.
	format: text("format"),
	name: text("name"),
	name_on_disk: text("name_on_disk").unique(),
	size: bigint("size", { mode: "number" }),
	// The file's complete object-storage key. Nullable because it was backfilled
	// from `name_on_disk`, which is itself nullable: a row without one names no
	// retrievable object.
	storage_key: text("storage_key").unique(),
	uploaded_at: timestamp("uploaded_at"),
});

// A BLAST request against one NuVs contig. Unique on
// (`analysis_id`, `sequence_index`): requesting a BLAST for a sequence that
// already has one replaces the previous row.
export const nuvsBlast = pgTable("nuvs_blast", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
	sequence_index: integer("sequence_index").notNull(),
	created_at: timestamp("created_at").notNull(),
	updated_at: timestamp("updated_at").notNull(),
	last_checked_at: timestamp("last_checked_at").notNull(),
	error: text("error"),
	interval: integer("interval").$defaultFn(() => 3),
	rid: text("rid"),
	ready: boolean("ready").notNull(),
	// `json`, not `jsonb` — the upstream column is `JSON`.
	result: json("result").$type<Record<string, unknown>>(),
	task_id: integer("task_id"),
});

/** A row from the `analyses` table. */
export type AnalysisRow = typeof analyses.$inferSelect;

/** A row from the `analysis_files` table. */
export type AnalysisFileRow = typeof analysisFiles.$inferSelect;

/** A row from the `nuvs_blast` table. */
export type NuvsBlastRow = typeof nuvsBlast.$inferSelect;
