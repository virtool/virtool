// Read-only mirror of the `hmms` and `legacy_hmm_status` tables managed by the
// upstream Python service via Alembic. Do not generate or push migrations from
// this side. Keep the columns in sync with
// `../../../../../../virtool/virtool/hmm/sql.py`.
//
// `hmms.legacy_id` holds the old Mongo `_id`. The HMM endpoints address rows by
// their integer id and never need it, but a NuVs analysis stored before the
// migration references its HMM annotations by that string, so the analysis
// formatter resolves them through this column.

import type { HmmEntry } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	doublePrecision,
	foreignKey,
	integer,
	jsonb,
	pgTable,
	text,
	unique,
} from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

/**
 * A stored HMM release description, as written to `legacy_hmm_status.release`
 * by the release-refresh path.
 */
export type HmmRelease = {
	body: string;
	content_type: string;
	download_url: string;
	filename: string;
	html_url: string;
	id: number;
	name: string;
	newer: boolean;
	published_at: string;
	retrieved_at: string;
	size: number;
};

/**
 * An entry in `legacy_hmm_status.updates`: a release plus the install metadata
 * appended when an install is started or completed.
 */
export type HmmUpdate = {
	body: string;
	created_at: string;
	filename: string;
	html_url: string;
	id: number;
	name: string;
	newer: boolean;
	published_at: string;
	ready: boolean;
	size: number;
	user: { id: number };
};

export const hmms = pgTable(
	"hmms",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		legacy_id: text("legacy_id"),
		cluster: integer("cluster").notNull(),
		count: integer("count").notNull(),
		length: integer("length").notNull(),
		mean_entropy: doublePrecision("mean_entropy").notNull(),
		total_entropy: doublePrecision("total_entropy").notNull(),
		hidden: boolean("hidden")
			.$defaultFn(() => false)
			.notNull(),
		names: jsonb("names").$type<string[]>().notNull(),
		families: jsonb("families").$type<Record<string, number>>().notNull(),
		genera: jsonb("genera").$type<Record<string, number>>().notNull(),
		entries: jsonb("entries").$type<HmmEntry[]>().notNull(),
	},
	(table) => [unique("hmms_legacy_id_key").on(table.legacy_id)],
);

/** A row from the `hmms` table. */
export type HmmRow = typeof hmms.$inferSelect;

export const legacyHmmStatus = pgTable(
	"legacy_hmm_status",
	{
		id: integer("id").primaryKey(),
		errors: jsonb("errors").$type<string[]>().notNull(),
		release: jsonb("release").$type<HmmRelease>(),
		installed: jsonb("installed").$type<HmmUpdate>(),
		task_id: integer("task_id"),
		updates: jsonb("updates").$type<HmmUpdate[]>().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.task_id],
			foreignColumns: [tasks.id],
			name: "legacy_hmm_status_task_id_fkey",
		}),
		check("ck_legacy_hmm_status_singleton", sql`${table.id} = 1`),
	],
);

/** A row from the `legacy_hmm_status` singleton table. */
export type HmmStatusRow = typeof legacyHmmStatus.$inferSelect;

/** The fixed primary key of the singleton `legacy_hmm_status` row. */
export const HMM_STATUS_ID = 1;
