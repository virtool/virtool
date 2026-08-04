// Read-only mirror of the `groups` and `user_groups` tables managed by the
// upstream Python service via Alembic. Do not generate or push migrations
// from this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/groups/pg.py` and
// `../../../../../../virtool/virtool/users/pg.py`.

import type { Permissions } from "@virtool/contracts";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const groups = pgTable("groups", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	legacyId: text("legacy_id").unique(),
	name: text("name").unique().notNull(),
	permissions: jsonb("permissions").$type<Permissions>().notNull(),
});

/** A row from the `groups` table. */
export type GroupRow = typeof groups.$inferSelect;

export const userGroups = pgTable(
	"user_groups",
	{
		groupId: integer("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		primary: boolean("primary")
			.$defaultFn(() => false)
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

/** A row from the `user_groups` association table. */
export type UserGroupRow = typeof userGroups.$inferSelect;
