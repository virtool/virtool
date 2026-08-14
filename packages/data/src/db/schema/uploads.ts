// Read-only mirror of the `uploads` table managed by the upstream Python
// service via Alembic. Do not generate or push migrations from this side. Keep
// the columns in sync with `../../../../../../virtool/virtool/uploads/sql.py`.

import type { UploadType } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const uploads = pgTable(
	"uploads",
	{
		id: serial("id").primaryKey(),
		createdAt: timestamp("created_at"),
		name: text("name"),
		nameOnDisk: text("name_on_disk"),
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
		// The upload's complete object-storage key. Nullable because it was
		// backfilled from `name_on_disk`, which is itself nullable: a row without one
		// names no retrievable object.
		storageKey: text("storage_key"),
		// The `hmm` member the old `uploadtype` enum carried is gone: the migration
		// that replaced the enum deleted those rows.
		type: text("type").$type<UploadType>(),
		uploadedAt: timestamp("uploaded_at"),
		userId: integer("user_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "uploads_user_id_fkey",
		}),
		unique("uploads_name_on_disk_key").on(table.nameOnDisk),
		unique("uq_uploads_storage_key").on(table.storageKey),
		check(
			"ck_uploads_type",
			sql`${table.type} in ('reference', 'reads', 'subtraction')`,
		),
	],
);

/** A row from the `uploads` table. */
export type UploadRow = typeof uploads.$inferSelect;
