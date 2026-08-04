// Read-only mirror of the `uploads` table managed by the upstream Python
// service via Alembic. Do not generate or push migrations from this side. Keep
// the columns in sync with `../../../../../../virtool/virtool/uploads/sql.py`.
//
// The legacy `space` column is a multi-tenant remnant that is never read or
// written from this side and never appears in a response, so it is left out of
// the mirror.

import {
	bigint,
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const uploads = pgTable("uploads", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at"),
	name: text("name"),
	nameOnDisk: text("name_on_disk").unique(),
	ready: boolean("ready")
		.$defaultFn(() => false)
		.notNull(),
	removed: boolean("removed")
		.$defaultFn(() => false)
		.notNull(),
	removedAt: timestamp("removed_at"),
	reserved: boolean("reserved")
		.$defaultFn(() => false)
		.notNull(),
	// Read sizes routinely exceed 2 GiB, past the range of a 32-bit integer, so
	// this mirrors Python's BigInteger. `mode: "number"` is safe up to 2^53.
	size: bigint("size", { mode: "number" }),
	type: text("type"),
	uploadedAt: timestamp("uploaded_at"),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
});

/** A row from the `uploads` table. */
export type UploadRow = typeof uploads.$inferSelect;
