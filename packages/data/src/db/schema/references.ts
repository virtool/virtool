// Read-only mirror of the `legacy_references`, `legacy_reference_users`, and
// `legacy_reference_groups` tables managed by the upstream Python service via
// Alembic. Do not generate or push migrations from this side. Keep the columns
// in sync with `../../../../../../virtool/virtool/references/sql.py`.
//
// The `legacy_id` column (the Mongo `_id`) is intentionally omitted: every
// reference served from this side is Postgres-native and keyed by its integer
// id, so nothing here reads or writes it.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const legacyReferences = pgTable("legacy_references", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	name: text("name").notNull(),
	description: text("description")
		.$defaultFn(() => "")
		.notNull(),
	organism: text("organism")
		.$defaultFn(() => "")
		.notNull(),
	created_at: timestamp("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	archived: boolean("archived")
		.$defaultFn(() => false)
		.notNull(),
	restrict_source_types: boolean("restrict_source_types")
		.$defaultFn(() => false)
		.notNull(),
	source_types: jsonb("source_types")
		.$type<string[]>()
		.$defaultFn(() => [])
		.notNull(),
	user_id: integer("user_id"),
	upload_id: integer("upload_id"),
	cloned_from_id: bigint("cloned_from_id", { mode: "number" }),
	task_id: integer("task_id"),
});

export const legacyReferenceUsers = pgTable(
	"legacy_reference_users",
	{
		reference_id: bigint("reference_id", { mode: "number" }).notNull(),
		user_id: integer("user_id").notNull(),
		build: boolean("build")
			.$defaultFn(() => false)
			.notNull(),
		modify: boolean("modify")
			.$defaultFn(() => false)
			.notNull(),
		modify_otu: boolean("modify_otu")
			.$defaultFn(() => false)
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.reference_id, table.user_id] })],
);

export const legacyReferenceGroups = pgTable(
	"legacy_reference_groups",
	{
		reference_id: bigint("reference_id", { mode: "number" }).notNull(),
		group_id: integer("group_id").notNull(),
		build: boolean("build")
			.$defaultFn(() => false)
			.notNull(),
		modify: boolean("modify")
			.$defaultFn(() => false)
			.notNull(),
		modify_otu: boolean("modify_otu")
			.$defaultFn(() => false)
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.reference_id, table.group_id] })],
);

/** A row from the `legacy_references` table. */
export type ReferenceRow = typeof legacyReferences.$inferSelect;

/** A row from the `legacy_reference_users` table. */
export type ReferenceUserRow = typeof legacyReferenceUsers.$inferSelect;

/** A row from the `legacy_reference_groups` table. */
export type ReferenceGroupRow = typeof legacyReferenceGroups.$inferSelect;
