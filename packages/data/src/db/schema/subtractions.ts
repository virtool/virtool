// Schema for the `subtractions` and `subtraction_files` tables.
//
// `legacy_id` (the Mongo `_id`) is null for Postgres-native subtractions. Every
// endpoint addresses a subtraction by its integer id. Nothing derives a storage
// key from either: each file records its own in `subtraction_files.storage_key`.

import type { SubtractionFileType } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";
import { uploads } from "./uploads";
import { users } from "./users";

/** The nucleotide composition of a subtraction genome, stored as JSONB. */
export type NucleotideComposition = {
	a: number;
	c: number;
	g: number;
	t: number;
	n: number;
};

export const subtractions = pgTable(
	"subtractions",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
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
		job_id: integer("job_id"),
		upload_id: integer("upload_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "subtractions_user_id_fkey",
		}),
		foreignKey({
			columns: [table.job_id],
			foreignColumns: [jobs.id],
			name: "subtractions_job_id_fkey",
		}),
		foreignKey({
			columns: [table.upload_id],
			foreignColumns: [uploads.id],
			name: "subtractions_upload_id_fkey",
		}),
		unique("subtractions_legacy_id_key").on(table.legacy_id),
		unique("subtractions_job_id_key").on(table.job_id),
	],
);

export const subtractionFiles = pgTable(
	"subtraction_files",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		name: text("name"),
		subtraction_id: bigint("subtraction_id", { mode: "number" }).notNull(),
		type: text("type").$type<SubtractionFileType>(),
		// Files routinely exceed 2 GiB, past the range of a 32-bit integer, hence
		// `bigint`. `mode: "number"` is safe up to 2^53.
		size: bigint("size", { mode: "number" }),
		// The file's complete object-storage key. Nullable because it was backfilled
		// from `name`, which is itself nullable: a row without one names no
		// retrievable object.
		storage_key: text("storage_key"),
	},
	(table) => [
		foreignKey({
			columns: [table.subtraction_id],
			foreignColumns: [subtractions.id],
			name: "subtraction_files_subtraction_id_fkey",
		}),
		unique("uq_subtraction_files_storage_key").on(table.storage_key),
		unique("subtraction_files_subtraction_id_name_key").on(
			table.subtraction_id,
			table.name,
		),
		check(
			"ck_subtraction_files_type",
			sql`${table.type} in ('fasta', 'bowtie2')`,
		),
	],
);

/** A row from the `subtractions` table. */
export type SubtractionRow = typeof subtractions.$inferSelect;

/** A row from the `subtraction_files` table. */
export type SubtractionFileRow = typeof subtractionFiles.$inferSelect;
