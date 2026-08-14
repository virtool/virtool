// Read-only mirror of the `labels` table managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns in sync with `../../../../../../virtool/virtool/labels/sql.py`.

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
