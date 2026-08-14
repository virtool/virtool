// Read-only mirror of the `legacy_samples` table and its join / file tables,
// managed by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/samples/sql.py`.

import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { jobs } from "./jobs";
import { labels } from "./labels";
import { subtractions } from "./subtractions";
import { uploads } from "./uploads";
import { users } from "./users";

/** A sample's FastQC quality report, stored as JSONB and never queried. */
export type SampleQuality = {
	bases: number[][];
	composition: number[][];
	count: number;
	encoding: string;
	gc: number;
	length: number[];
	sequences: number[];
};

// The columns Python's model gives a `default=` are mirrored with `$defaultFn`,
// never `.default()`: the real columns carry no server default, so the value has
// to be supplied on insert from this side too. `name`, `library_type`, and
// `created_at` have no Python default and stay required.
export const legacySamples = pgTable(
	"legacy_samples",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
		name: text("name").notNull(),
		host: text("host")
			.$defaultFn(() => "")
			.notNull(),
		isolate: text("isolate")
			.$defaultFn(() => "")
			.notNull(),
		locale: text("locale")
			.$defaultFn(() => "")
			.notNull(),
		notes: text("notes")
			.$defaultFn(() => "")
			.notNull(),
		library_type: text("library_type").notNull(),
		format: text("format")
			.$defaultFn(() => "fastq")
			.notNull(),
		group_id: integer("group_id").references(() => groups.id),
		quality: jsonb("quality").$type<SampleQuality>(),
		created_at: timestamp("created_at").notNull(),
		paired: boolean("paired")
			.$defaultFn(() => false)
			.notNull(),
		ready: boolean("ready")
			.$defaultFn(() => false)
			.notNull(),
		hold: boolean("hold")
			.$defaultFn(() => true)
			.notNull(),
		is_legacy: boolean("is_legacy")
			.$defaultFn(() => false)
			.notNull(),
		all_read: boolean("all_read")
			.$defaultFn(() => false)
			.notNull(),
		all_write: boolean("all_write")
			.$defaultFn(() => false)
			.notNull(),
		group_read: boolean("group_read")
			.$defaultFn(() => false)
			.notNull(),
		group_write: boolean("group_write")
			.$defaultFn(() => false)
			.notNull(),
		user_id: integer("user_id").references(() => users.id),
		job_id: integer("job_id").references(() => jobs.id),
	},
	(table) => [
		unique("legacy_samples_legacy_id_key").on(table.legacy_id),
		unique("legacy_samples_job_id_key").on(table.job_id),
		index("ix_legacy_samples_all_read")
			.on(table.all_read)
			.where(sql`${table.all_read} = true`),
		index("ix_legacy_samples_group_id").on(table.group_id),
		index("ix_legacy_samples_group_read")
			.on(table.group_read)
			.where(sql`${table.group_read} = true`),
		index("ix_legacy_samples_user_id_created_at").on(
			table.user_id,
			table.created_at.desc().nullsFirst(),
		),
	],
);

// Join table linking a sample to its labels.
export const legacySampleLabels = pgTable(
	"legacy_sample_labels",
	{
		sample_id: bigint("sample_id", { mode: "number" })
			.notNull()
			.references(() => legacySamples.id, { onDelete: "cascade" }),
		label_id: integer("label_id")
			.notNull()
			.references(() => labels.id),
	},
	(table) => [
		primaryKey({
			name: "legacy_sample_labels_pkey",
			columns: [table.sample_id, table.label_id],
		}),
	],
);

// Join table linking a sample to its default subtractions. Read from the
// subtraction side to count a subtraction's `sampleCount`.
export const legacySampleSubtractions = pgTable(
	"legacy_sample_subtractions",
	{
		sample_id: bigint("sample_id", { mode: "number" })
			.notNull()
			.references(() => legacySamples.id, { onDelete: "cascade" }),
		subtraction_id: bigint("subtraction_id", { mode: "number" })
			.notNull()
			.references(() => subtractions.id),
	},
	(table) => [
		primaryKey({
			name: "legacy_sample_subtractions_pkey",
			columns: [table.sample_id, table.subtraction_id],
		}),
	],
);

// Reads files that make up a sample.
export const sampleReads = pgTable(
	"sample_reads",
	{
		id: serial("id").primaryKey(),
		sample: text("sample").notNull(),
		sample_id: bigint("sample_id", { mode: "number" }).references(
			() => legacySamples.id,
		),
		name: varchar("name", { length: 13 }).notNull(),
		name_on_disk: text("name_on_disk").notNull(),
		size: bigint("size", { mode: "number" }),
		// The reads file's complete object-storage key.
		storage_key: text("storage_key").notNull(),
		upload: integer("upload").references(() => uploads.id),
		uploaded_at: timestamp("uploaded_at"),
	},
	(table) => [
		unique("uq_sample_reads_storage_key").on(table.storage_key),
		unique("sample_reads_sample_id_name_key").on(table.sample_id, table.name),
		unique("sample_reads_sample_name_key").on(table.sample, table.name),
	],
);

// Join table linking a sample to its input uploads, ordered by `index`.
export const sampleUploads = pgTable(
	"sample_uploads",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		sample: text("sample").notNull(),
		sample_id: bigint("sample_id", { mode: "number" }).references(
			() => legacySamples.id,
		),
		upload_id: integer("upload_id")
			.notNull()
			.references(() => uploads.id),
		index: integer("index").notNull(),
	},
	(table) => [unique("sample_uploads_upload_id_key").on(table.upload_id)],
);

/** A row from the `legacy_samples` table. */
export type LegacySampleRow = typeof legacySamples.$inferSelect;
