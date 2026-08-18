// Schema for the `labels` table.

import { pgTable, serial, text, unique, varchar } from "drizzle-orm/pg-core";

export const labels = pgTable(
	"labels",
	{
		id: serial("id").primaryKey(),
		color: varchar("color", { length: 7 }),
		description: text("description").$defaultFn(() => ""),
		name: text("name"),
	},
	(table) => [unique("labels_name_key").on(table.name)],
);

/** A row from the `labels` table. */
export type LabelRow = typeof labels.$inferSelect;
