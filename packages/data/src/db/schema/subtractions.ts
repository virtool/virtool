// Read-only mirror of the `subtractions` and `subtraction_files` tables managed
// by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/subtractions/pg.py`.
//
// `legacy_id` (the Mongo `_id`) is null for Postgres-native subtractions. Every
// endpoint addresses a subtraction by its integer id, but its files live under
// the legacy id when it has one — see `subtractionStorageId`.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/** The nucleotide composition of a subtraction genome, stored as JSONB. */
export type NucleotideComposition = {
	a: number;
	c: number;
	g: number;
	t: number;
	n: number;
};

/** One of the file types a subtraction can hold. */
export type SubtractionFileType = "fasta" | "bowtie2";

export const subtractions = pgTable("subtractions", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
	name: text("name").notNull(),
	nickname: text("nickname")
		.$defaultFn(() => "")
		.notNull(),
	count: integer("count"),
	gc: jsonb("gc").$type<NucleotideComposition>(),
	created_at: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	deleted: boolean("deleted")
		.$defaultFn(() => false)
		.notNull(),
	ready: boolean("ready")
		.$defaultFn(() => false)
		.notNull(),
	user_id: integer("user_id"),
	job_id: integer("job_id").unique(),
	upload_id: integer("upload_id"),
});

export const subtractionFiles = pgTable("subtraction_files", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	name: text("name"),
	subtraction_id: bigint("subtraction_id", { mode: "number" }).notNull(),
	type: text("type").$type<SubtractionFileType>(),
	// Files routinely exceed 2 GiB, past the range of a 32-bit integer, so this
	// mirrors Python's BigInteger. `mode: "number"` is safe up to 2^53.
	size: bigint("size", { mode: "number" }),
});

/** A row from the `subtractions` table. */
export type SubtractionRow = typeof subtractions.$inferSelect;

/** A row from the `subtraction_files` table. */
export type SubtractionFileRow = typeof subtractionFiles.$inferSelect;
