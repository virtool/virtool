// Read-only mirror of the `legacy_references`, `legacy_reference_users`, and
// `legacy_reference_groups` tables managed by the upstream Python service via
// Alembic. Do not generate or push migrations from this side. Keep the columns
// in sync with `../../../../../../virtool/virtool/references/sql.py`.

import {
	bigint,
	boolean,
	foreignKey,
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
		user_id: integer("user_id").notNull(),
		upload_id: integer("upload_id"),
		cloned_from_id: bigint("cloned_from_id", { mode: "number" }),
		task_id: integer("task_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "legacy_references_user_id_fkey",
		}),
		foreignKey({
			columns: [table.upload_id],
			foreignColumns: [uploads.id],
			name: "legacy_references_upload_id_fkey",
		}),
		foreignKey({
			columns: [table.cloned_from_id],
			foreignColumns: [table.id],
			name: "legacy_references_cloned_from_id_fkey",
		}),
		foreignKey({
			columns: [table.task_id],
			foreignColumns: [tasks.id],
			name: "legacy_references_task_id_fkey",
		}),
		unique("legacy_references_legacy_id_key").on(table.legacy_id),
	],
);

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
	(table) => [
		foreignKey({
			columns: [table.reference_id],
			foreignColumns: [legacyReferences.id],
			name: "legacy_reference_users_reference_id_fkey",
		}),
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "legacy_reference_users_user_id_fkey",
		}),
		primaryKey({
			name: "legacy_reference_users_pkey",
			columns: [table.reference_id, table.user_id],
		}),
	],
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
	(table) => [
		foreignKey({
			columns: [table.reference_id],
			foreignColumns: [legacyReferences.id],
			name: "legacy_reference_groups_reference_id_fkey",
		}),
		foreignKey({
			columns: [table.group_id],
			foreignColumns: [groups.id],
			name: "legacy_reference_groups_group_id_fkey",
		}),
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
