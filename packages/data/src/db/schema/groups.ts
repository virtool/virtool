// Read-only mirror of the `groups` and `user_groups` tables managed by the
// upstream Python service via Alembic. Do not generate or push migrations
// from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/groups/pg.py` and
// `../../../../../../virtool/virtool/users/pg.py`.

import type { Permissions } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	unique,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const groups = pgTable(
	"groups",
	{
		id: serial("id").primaryKey(),
		legacyId: text("legacy_id"),
		name: varchar("name", { length: 255 }).unique().notNull(),
		permissions: jsonb("permissions").$type<Permissions>().notNull(),
	},
	(table) => [unique("groups_legacy_id_key").on(table.legacyId)],
);

/** A row from the `groups` table. */
export type GroupRow = typeof groups.$inferSelect;

export const userGroups = pgTable(
	"user_groups",
	{
		groupId: integer("group_id").notNull(),
		userId: integer("user_id").notNull(),
		primary: boolean("primary")
			.$defaultFn(() => false)
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "user_groups_group_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_groups_user_id_fkey",
		}).onDelete("cascade"),
		primaryKey({
			name: "user_groups_pkey",
			columns: [table.groupId, table.userId],
		}),
		/* `WHERE false` indexes no row, so this enforces nothing. It is what
		   upstream created and is mirrored as-is; narrowing the predicate to what
		   the name implies would start rejecting rows the real database accepts. */
		uniqueIndex("primary_group_unique")
			.on(table.primary, table.userId)
			.where(sql`false`),
	],
);

/** A row from the `user_groups` association table. */
export type UserGroupRow = typeof userGroups.$inferSelect;
