// Mirror of the two migration-bookkeeping tables. Neither is read nor written
// from this side: `alembic_version` is Alembic's applied-revision pointer, and
// `revisions` belongs to Python's own migration runner
// (`../../../../../../virtool/virtool/migration/pg.py`).
//
// They are declared only so the schema snapshot describes production. A table
// missing from this schema is missing from the snapshot, so nothing could
// generate the migration that drops it — the same reasoning that keeps
// `analyses`' dead `reference` and `index` columns declared. Both tables go
// when Python does.

import {
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";

/** @public The single row naming the Alembic revision production is at. */
export const alembicVersion = pgTable(
	"alembic_version",
	{
		version_num: varchar("version_num", { length: 32 }).notNull(),
	},
	(table) => [
		/* `_pkc`, not the inferred `_pkey`: Alembic names this constraint itself
		   and production carries that name. */
		primaryKey({
			name: "alembic_version_pkc",
			columns: [table.version_num],
		}),
	],
);

/** @public One applied revision of Python's own migration runner. */
export const revisions = pgTable(
	"revisions",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		revision: text("revision"),
		created_at: timestamp("created_at").notNull(),
		applied_at: timestamp("applied_at").notNull(),
	},
	(table) => [unique("revisions_revision_key").on(table.revision)],
);
