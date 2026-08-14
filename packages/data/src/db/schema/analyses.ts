// Read-only mirror of the `analyses` table and its join / file tables, managed
// by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/analyses/sql.py` and
// `../../../../../../virtool/virtool/blast/sql.py`.
//
// Python's `analysis_results` / `SQLAnalysisResult` table is mirrored in
// `./vestigial.ts` instead — nothing reads it and its own docstring calls it
// temporary, so it is declared for snapshot fidelity alone.
//
// `reference` and `index` are dead, superseded by `reference_id` and
// `index_id`. They are declared anyway: a column missing from this schema is
// missing from the migration snapshot, so nothing could generate the migration
// that drops it.

import { AnalysisFormat } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	json,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";
import { indexes } from "./indexes";
import { jobs } from "./jobs";
import { legacyReferences } from "./references";
import { legacySamples } from "./samples";
import { subtractions } from "./subtractions";
import { tasks } from "./tasks";
import { users } from "./users";

// `z.enum().options` widens to an array, losing the non-empty tuple `pgEnum`
// takes. Cast rather than restate the members, which would be free to disagree.
export const analysisFormat = pgEnum(
	"analysisformat",
	AnalysisFormat.options as [AnalysisFormat, ...AnalysisFormat[]],
);

export const analyses = pgTable(
	"analyses",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
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
		reference: text("reference"),
		reference_id: bigint("reference_id", { mode: "number" }),
		index: text("index"),
		index_id: bigint("index_id", { mode: "number" }).notNull(),
		user_id: integer("user_id").notNull(),
		job_id: integer("job_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.sample_id],
			foreignColumns: [legacySamples.id],
			name: "analyses_sample_id_fkey",
		}),
		foreignKey({
			columns: [table.reference_id],
			foreignColumns: [legacyReferences.id],
			name: "analyses_reference_id_fkey",
		}),
		foreignKey({
			columns: [table.index_id],
			foreignColumns: [indexes.id],
			name: "analyses_index_id_fkey",
		}),
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "analyses_user_id_fkey",
		}),
		foreignKey({
			columns: [table.job_id],
			foreignColumns: [jobs.id],
			name: "analyses_job_id_fkey",
		}),
		unique("analyses_legacy_id_key").on(table.legacy_id),
		index("ix_analyses_sample").on(table.sample),
		index("ix_analyses_sample_id_workflow").on(table.sample_id, table.workflow),
		check(
			"ck_analyses_reference_present",
			sql`num_nonnulls(${table.reference}, ${table.reference_id}) >= 1`,
		),
	],
);

export const analysisSubtractions = pgTable(
	"analysis_subtractions",
	{
		analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
		subtraction_id: bigint("subtraction_id", { mode: "number" }).notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.analysis_id],
			foreignColumns: [analyses.id],
			name: "analysis_subtractions_analysis_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.subtraction_id],
			foreignColumns: [subtractions.id],
			name: "analysis_subtractions_subtraction_id_fkey",
		}),
		primaryKey({
			name: "analysis_subtractions_pkey",
			columns: [table.analysis_id, table.subtraction_id],
		}),
		index("ix_analysis_subtractions_subtraction_id").on(table.subtraction_id),
	],
);

// Result files retained by a workflow and offered for download. Written only by
// the jobs API, which is out of scope here — this side reads them.
export const analysisFiles = pgTable(
	"analysis_files",
	{
		id: serial("id").primaryKey(),
		analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
		description: text("description"),
		format: analysisFormat("format"),
		name: text("name"),
		name_on_disk: text("name_on_disk"),
		size: bigint("size", { mode: "number" }),
		// The file's complete object-storage key. Nullable because it was backfilled
		// from `name_on_disk`, which is itself nullable: a row without one names no
		// retrievable object.
		storage_key: text("storage_key"),
		uploaded_at: timestamp("uploaded_at"),
	},
	(table) => [
		foreignKey({
			columns: [table.analysis_id],
			foreignColumns: [analyses.id],
			name: "analysis_files_analysis_id_fkey",
		}).onDelete("cascade"),
		unique("analysis_files_name_on_disk_key").on(table.name_on_disk),
		unique("uq_analysis_files_storage_key").on(table.storage_key),
	],
);

// A BLAST request against one NuVs contig. Unique on
// (`analysis_id`, `sequence_index`): requesting a BLAST for a sequence that
// already has one replaces the previous row.
export const nuvsBlast = pgTable(
	"nuvs_blast",
	{
		id: serial("id").primaryKey(),
		analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
		sequence_index: integer("sequence_index").notNull(),
		created_at: timestamp("created_at").notNull(),
		updated_at: timestamp("updated_at").notNull(),
		last_checked_at: timestamp("last_checked_at").notNull(),
		error: text("error"),
		interval: integer("interval").$defaultFn(() => 3),
		rid: varchar("rid", { length: 24 }),
		ready: boolean("ready").notNull(),
		// `json`, not `jsonb` — the upstream column is `JSON`.
		result: json("result").$type<Record<string, unknown>>(),
		task_id: integer("task_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.analysis_id],
			foreignColumns: [analyses.id],
			name: "nuvs_blast_analysis_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.task_id],
			foreignColumns: [tasks.id],
			name: "nuvs_blast_task_id_fkey",
		}),
		unique("nuvs_blast_analysis_id_sequence_index_key").on(
			table.analysis_id,
			table.sequence_index,
		),
	],
);

/** A row from the `analyses` table. */
export type AnalysisRow = typeof analyses.$inferSelect;

/** A row from the `analysis_files` table. */
export type AnalysisFileRow = typeof analysisFiles.$inferSelect;

/** A row from the `nuvs_blast` table. */
export type NuvsBlastRow = typeof nuvsBlast.$inferSelect;
