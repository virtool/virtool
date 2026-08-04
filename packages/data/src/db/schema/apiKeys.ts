// Read-only mirror of the `api_keys` table managed by the upstream Python
// service via Alembic. Do not generate or push migrations from this side. Keep
// the columns in sync with `../../../../../../virtool/virtool/account/sql.py`.

import type { Permissions } from "@virtool/contracts";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const apiKeys = pgTable("api_keys", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	hashed: text("hashed").notNull().unique(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").notNull(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	permissions: jsonb("permissions").$type<Permissions>().notNull(),
});

/** A row from the `api_keys` table. */
export type ApiKeyRow = typeof apiKeys.$inferSelect;
