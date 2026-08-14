// Read-only mirror of the `legacy_references`, `legacy_reference_users`, and
// `legacy_reference_groups` tables managed by the upstream Python service via
// Alembic. Do not generate or push migrations from this side. Keep the columns
// in sync with `../../../../../../virtool/virtool/references/sql.py`.

import {
	type AnyPgColumn,
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { tasks } from "./tasks";
import { uploads } from "./uploads";
import { users } from "./users";

export const legacyReferences = pgTable(
	"legacy_references",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
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
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
		upload_id: integer("upload_id").references(() => uploads.id),
		cloned_from_id: bigint("cloned_from_id", { mode: "number" }).references(
			(): AnyPgColumn => legacyReferences.id,
		),
		task_id: integer("task_id").references(() => tasks.id),
	},
	(table) => [unique("legacy_references_legacy_id_key").on(table.legacy_id)],
);

export const legacyReferenceUsers = pgTable(
	"legacy_reference_users",
	{
		reference_id: bigint("reference_id", { mode: "number" })
			.notNull()
			.references(() => legacyReferences.id),
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
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
	(table) => [
		primaryKey({
			name: "legacy_reference_users_pkey",
			columns: [table.reference_id, table.user_id],
		}),
	],
);

export const legacyReferenceGroups = pgTable(
	"legacy_reference_groups",
	{
		reference_id: bigint("reference_id", { mode: "number" })
			.notNull()
			.references(() => legacyReferences.id),
		group_id: integer("group_id")
			.notNull()
			.references(() => groups.id),
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
	(table) => [
		primaryKey({
			name: "legacy_reference_groups_pkey",
			columns: [table.reference_id, table.group_id],
		}),
	],
);

/** A row from the `legacy_references` table. */
export type ReferenceRow = typeof legacyReferences.$inferSelect;

/** A row from the `legacy_reference_users` table. */
export type ReferenceUserRow = typeof legacyReferenceUsers.$inferSelect;

/** A row from the `legacy_reference_groups` table. */
export type ReferenceGroupRow = typeof legacyReferenceGroups.$inferSelect;
