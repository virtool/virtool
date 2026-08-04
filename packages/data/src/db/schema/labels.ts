// Read-only mirror of the `labels` table managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns in sync with `../../../../../../virtool/virtool/labels/sql.py`.

import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const labels = pgTable("labels", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	color: varchar("color", { length: 7 }),
	description: text("description").$defaultFn(() => ""),
	name: text("name").unique(),
	space: integer("space"),
});

/** A row from the `labels` table. */
export type LabelRow = typeof labels.$inferSelect;
