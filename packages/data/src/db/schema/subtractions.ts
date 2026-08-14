// Read-only mirror of the `subtractions` and `subtraction_files` tables managed
// by the upstream Python service via Alembic. Do not generate or push
// migrations from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/subtractions/pg.py`.
//
// `legacy_id` (the Mongo `_id`) is null for Postgres-native subtractions. Every
// endpoint addresses a subtraction by its integer id. Nothing derives a storage
// key from either: each file records its own in `subtraction_files.storage_key`.

import { SubtractionFileType } from "@virtool/contracts";
import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";
import { uploads } from "./uploads";
import { users } from "./users";

// `z.enum().options` widens to an array, losing the non-empty tuple `pgEnum`
// takes. Cast rather than restate the members, which would be free to disagree.
export const subtractionType = pgEnum(
	"subtractiontype",
	SubtractionFileType.options as [
		SubtractionFileType,
		...SubtractionFileType[],
	],
);

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
		user_id: integer("user_id").references(() => users.id),
		job_id: integer("job_id").references(() => jobs.id),
		upload_id: integer("upload_id").references(() => uploads.id),
	},
	(table) => [
		unique("subtractions_legacy_id_key").on(table.legacy_id),
		unique("subtractions_job_id_key").on(table.job_id),
	],
);

export const subtractionFiles = pgTable(
	"subtraction_files",
	{
		id: serial("id").primaryKey(),
		name: text("name"),
		subtraction_id: bigint("subtraction_id", { mode: "number" })
			.notNull()
			.references(() => subtractions.id),
		type: subtractionType("type"),
		// Files routinely exceed 2 GiB, past the range of a 32-bit integer, so this
		// mirrors Python's BigInteger. `mode: "number"` is safe up to 2^53.
		size: bigint("size", { mode: "number" }),
		// The file's complete object-storage key. Nullable because it was backfilled
		// from `name`, which is itself nullable: a row without one names no
		// retrievable object.
		storage_key: text("storage_key"),
	},
	(table) => [
		unique("uq_subtraction_files_storage_key").on(table.storage_key),
		unique("subtraction_files_subtraction_id_name_key").on(
			table.subtraction_id,
			table.name,
		),
	],
);

/** A row from the `subtractions` table. */
export type SubtractionRow = typeof subtractions.$inferSelect;

/** A row from the `subtraction_files` table. */
export type SubtractionFileRow = typeof subtractionFiles.$inferSelect;
