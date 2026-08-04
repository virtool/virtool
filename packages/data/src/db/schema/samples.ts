// Read-only mirror of the `legacy_samples` table and its join / file tables,
// managed by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/samples/sql.py`.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

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
export const legacySamples = pgTable("legacy_samples", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
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
	group_id: integer("group_id"),
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
	user_id: integer("user_id"),
	job_id: integer("job_id").unique(),
});

// Join table linking a sample to its labels.
export const legacySampleLabels = pgTable("legacy_sample_labels", {
	sample_id: bigint("sample_id", { mode: "number" }).notNull(),
	label_id: integer("label_id").notNull(),
});

// Join table linking a sample to its default subtractions. Read from the
// subtraction side to compute a subtraction's `linked_samples`.
export const legacySampleSubtractions = pgTable("legacy_sample_subtractions", {
	sample_id: bigint("sample_id", { mode: "number" }).notNull(),
	subtraction_id: bigint("subtraction_id", { mode: "number" }).notNull(),
});

// Artifacts produced during sample creation.
export const sampleArtifacts = pgTable("sample_artifacts", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	sample: text("sample").notNull(),
	sample_id: bigint("sample_id", { mode: "number" }),
	name: text("name").notNull(),
	name_on_disk: text("name_on_disk"),
	size: bigint("size", { mode: "number" }),
	type: text("type").notNull(),
	uploaded_at: timestamp("uploaded_at"),
});

// Reads files that make up a sample.
export const sampleReads = pgTable("sample_reads", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	sample: text("sample").notNull(),
	sample_id: bigint("sample_id", { mode: "number" }),
	name: text("name").notNull(),
	name_on_disk: text("name_on_disk").notNull(),
	size: bigint("size", { mode: "number" }),
	upload: integer("upload"),
	uploaded_at: timestamp("uploaded_at"),
});

// Join table linking a sample to its input uploads, ordered by `index`.
export const sampleUploads = pgTable("sample_uploads", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	sample: text("sample").notNull(),
	sample_id: bigint("sample_id", { mode: "number" }),
	upload_id: integer("upload_id").notNull(),
	index: integer("index").notNull(),
});

/** A row from the `legacy_samples` table. */
export type LegacySampleRow = typeof legacySamples.$inferSelect;
