// Partial mirror of the `legacy_history` and `legacy_history_diff` tables.
// Python owns the schema and its Alembic migrations; do not generate or push
// migrations from this side. Keep in sync with
// `../../../../../../virtool/virtool/history/sql.py`.
//
// Both tables are written from here now that OTU mutations are served from this
// side — every OTU change records a history row and its diff. `reference` and
// `index` are dead, superseded by the `reference_id` and `index_id` foreign
// keys; an insert omits them and leaves them NULL, exactly as Python's does.
// They are declared anyway: a column missing from this schema is missing from
// the migration snapshot, so nothing could generate the migration that drops
// it.

import {
	bigint,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { indexes } from "./indexes";
import { legacyReferences } from "./references";
import { users } from "./users";

export const legacyHistory = pgTable(
	"legacy_history",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
		created_at: timestamp("created_at").notNull(),
		description: text("description").notNull(),
		method_name: text("method_name").notNull(),
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
		// A bare string column with no foreign key by design: `legacy_otus` keys on
		// the 8-character Mongo id and has no `legacy_id`, so this already holds the
		// OTU's primary key.
		otu: text("otu").notNull(),
		otu_name: text("otu_name").notNull(),
		// A stringified integer. `NULL` is the `"removed"` sentinel, normalised on
		// write upstream — the column never stores the sentinel itself.
		otu_version: text("otu_version"),
		reference: text("reference"),
		reference_id: bigint("reference_id", { mode: "number" }).references(
			() => legacyReferences.id,
		),
		index: text("index"),
		index_id: bigint("index_id", { mode: "number" }).references(
			() => indexes.id,
		),
	},
	(table) => [
		unique("legacy_history_legacy_id_key").on(table.legacy_id),
		index("ix_legacy_history_index").on(table.index),
		index("ix_legacy_history_index_id").on(table.index_id),
		index("ix_legacy_history_otu_otu_version").on(
			table.otu,
			table.otu_version.desc().nullsFirst(),
		),
		index("ix_legacy_history_reference").on(table.reference),
		index("ix_legacy_history_reference_id").on(table.reference_id),
		index("ix_legacy_history_user_id").on(table.user_id),
	],
);

// The change's diff, held 1:1 with its history row. Upstream calls this a
// temporary table to be dropped once history is renormalized.
export const legacyHistoryDiff = pgTable(
	"legacy_history_diff",
	{
		id: serial("id"),
		// The change's public id, duplicating `legacy_history.legacy_id`. It predates
		// `history_id` and Python still writes it, so an insert from here must too —
		// the column is NOT NULL upstream.
		change_id: text("change_id").notNull(),
		history_id: bigint("history_id", { mode: "number" }).references(
			() => legacyHistory.id,
		),
		// A dictdiffer diff: an array of `[action, path, changes]` triples, shaped by
		// `@server/history/dictdiffer` and opaque to the database.
		diff: jsonb("diff").$type<unknown>().notNull(),
	},
	(table) => [
		/* `history_diffs_*` rather than `legacy_history_diff_*`: the constraint
		   predates the table's rename and production never renamed it. The primary
		   key is named for the same reason — an inferred one would be
		   `legacy_history_diff_pkey`, which production does not have. */
		primaryKey({ name: "history_diffs_pkey", columns: [table.id] }),
		unique("history_diffs_change_id_key").on(table.change_id),
		unique("legacy_history_diff_history_id_key").on(table.history_id),
	],
);

/** A row from the `legacy_history` table. */
export type HistoryRow = typeof legacyHistory.$inferSelect;

/** A row from the `legacy_history_diff` table. */
export type HistoryDiffRow = typeof legacyHistoryDiff.$inferSelect;
