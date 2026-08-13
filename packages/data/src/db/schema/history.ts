// Partial mirror of the `legacy_history` and `legacy_history_diff` tables.
// Python owns the schema and its Alembic migrations; do not generate or push
// migrations from this side. Keep in sync with
// `../../../../../../virtool/virtool/history/sql.py`.
//
// Both tables are written from here now that OTU mutations are served from this
// side — every OTU change records a history row and its diff. The two legacy
// string columns Python no longer writes, `legacy_history.reference` and
// `legacy_history.index`, are deliberately not declared: they are superseded by
// the `reference_id` and `index_id` foreign keys and an insert that omits them
// leaves them NULL, exactly as Python's does.

import {
	bigint,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const legacyHistory = pgTable("legacy_history", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
	created_at: timestamp("created_at").notNull(),
	description: text("description").notNull(),
	method_name: text("method_name").notNull(),
	user_id: integer("user_id").notNull(),
	// A bare string column with no foreign key by design: `legacy_otus` keys on
	// the 8-character Mongo id and has no `legacy_id`, so this already holds the
	// OTU's primary key.
	otu: text("otu").notNull(),
	otu_name: text("otu_name").notNull(),
	// A stringified integer. `NULL` is the `"removed"` sentinel, normalised on
	// write upstream — the column never stores the sentinel itself.
	otu_version: text("otu_version"),
	reference_id: bigint("reference_id", { mode: "number" }),
	index_id: bigint("index_id", { mode: "number" }),
});

// The change's diff, held 1:1 with its history row. Upstream calls this a
// temporary table to be dropped once history is renormalized.
export const legacyHistoryDiff = pgTable("legacy_history_diff", {
	id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
	// The change's public id, duplicating `legacy_history.legacy_id`. It predates
	// `history_id` and Python still writes it, so an insert from here must too —
	// the column is NOT NULL upstream.
	change_id: text("change_id").unique().notNull(),
	history_id: bigint("history_id", { mode: "number" }).unique(),
	// A dictdiffer diff: an array of `[action, path, changes]` triples, shaped by
	// `@server/history/dictdiffer` and opaque to the database.
	diff: jsonb("diff").$type<unknown>().notNull(),
});

/** A row from the `legacy_history` table. */
export type HistoryRow = typeof legacyHistory.$inferSelect;

/** A row from the `legacy_history_diff` table. */
export type HistoryDiffRow = typeof legacyHistoryDiff.$inferSelect;
