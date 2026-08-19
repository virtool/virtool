// Schema for the `instance_messages` table.

import type { BannerColor } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const instanceMessages = pgTable(
	"instance_messages",
	{
		id: serial("id").primaryKey(),
		active: boolean("active").$defaultFn(() => true),
		color: text("color").$type<BannerColor>().notNull(),
		message: text("message"),
		createdAt: timestamp("created_at"),
		updatedAt: timestamp("updated_at"),
		// Nullable upstream: the Mongo-era rows arrived without one and were
		// backfilled. Every read joins on it, so a row the backfill missed is
		// simply invisible.
		userId: integer("user_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "instance_messages_user_id_fkey",
		}),
		uniqueIndex("instance_messages_one_active")
			.on(table.active)
			.where(sql`${table.active} = true`),
		check(
			"ck_instance_messages_color",
			sql`${table.color} in ('red', 'yellow', 'blue', 'purple', 'orange', 'grey')`,
		),
	],
);

/** A row from the `instance_messages` table. */
export type InstanceMessageRow = typeof instanceMessages.$inferSelect;
