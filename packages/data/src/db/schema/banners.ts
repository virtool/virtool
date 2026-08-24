// Schema for the `banners` table.

import type { BannerColor } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const banners = pgTable(
	"banners",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
			name: "banners_user_id_fkey",
		}),
		uniqueIndex("banners_one_active")
			.on(table.active)
			.where(sql`${table.active} = true`),
		check(
			"ck_banners_color",
			sql`${table.color} in ('red', 'yellow', 'blue', 'purple', 'orange', 'grey')`,
		),
	],
);

/** A row from the `banners` table. */
export type BannerRow = typeof banners.$inferSelect;
