// Mirror of the `legacy_otus` and `legacy_sequences` tables. Python owns the
// schema and its Alembic migrations; do not generate or push migrations from
// this side. Keep in sync with
// `../../../../../../virtool/virtool/otus/sql.py`.
//
// These are hybrid tables: the verbatim Mongo document lives in `data` and the
// remaining columns are promoted from it for querying. `data` is the source of
// truth for reconstruction, because the promoted columns are a lossy projection
// — they carry nothing of `lower_name`, an isolate's fields, or a sequence's
// `reference`, and normalise `abbreviation` and `segment` on the way in. A
// joined OTU feeds diffs that address the document as it was written, so
// anything the projection drops would corrupt a patch.
//
// That constraint governs writes from this side too. Python still writes these
// tables — reference import, clone, remote update, and index build all do — so
// a write from here must produce the same document shape, `data` included, or
// the diffs already recorded against it stop applying.

import {
	bigint,
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
} from "drizzle-orm/pg-core";

export const legacyOtus = pgTable("legacy_otus", {
	// The upstream primary key is the 8-character Mongo id, a plain string with
	// no identity sequence.
	id: text("id").primaryKey(),
	data: jsonb("data").$type<Record<string, unknown>>().notNull(),
	name: text("name").notNull(),
	abbreviation: text("abbreviation")
		.$defaultFn(() => "")
		.notNull(),
	last_indexed_version: integer("last_indexed_version"),
	reference_id: bigint("reference_id", { mode: "number" }).notNull(),
	verified: boolean("verified").notNull(),
	version: integer("version").notNull(),
});

// A sequence belonging to an isolate embedded in an OTU. `isolate_id` is not a
// foreign key: isolates are not a table upstream, they live in
// `legacy_otus.data`.
//
// `position` is load-bearing. It records insertion order within the OTU, which
// is the order the Mongo cursor returned sequences in, and historical diffs
// encode changes to an isolate's sequence list by index. A joined OTU must
// present its sequences in this order or a patch lands on the wrong sequence.
// Deletes leave gaps rather than renumbering, so only relative order matters.
export const legacySequences = pgTable("legacy_sequences", {
	id: text("id").primaryKey(),
	data: jsonb("data").$type<Record<string, unknown>>().notNull(),
	otu_id: text("otu_id").notNull(),
	isolate_id: text("isolate_id").notNull(),
	segment: text("segment"),
	position: bigint("position", { mode: "number" }),
});

/** A row from the `legacy_otus` table. */
export type OtuRow = typeof legacyOtus.$inferSelect;

/** A row from the `legacy_sequences` table. */
export type SequenceRow = typeof legacySequences.$inferSelect;
