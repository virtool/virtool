// Schema for the per-user "recently viewed" tracking tables.

import {
	bigint,
	foreignKey,
	index,
	integer,
	pgTable,
	primaryKey,
	timestamp,
} from "drizzle-orm/pg-core";
import { analyses } from "./analyses";
import { legacySamples } from "./samples";
import { users } from "./users";

// One row per (user, sample): opening a sample again bumps `viewed_at` rather
// than inserting a second row, so history never grows past one row per sample a
// user has seen and "recently viewed" is `order by viewed_at desc`. The rows
// cascade with their sample and user, so a deleted sample leaves none behind.
export const sampleViews = pgTable(
	"sample_views",
	{
		user_id: integer("user_id").notNull(),
		sample_id: bigint("sample_id", { mode: "number" }).notNull(),
		viewed_at: timestamp("viewed_at").notNull(),
	},
	(table) => [
		primaryKey({
			name: "sample_views_pkey",
			columns: [table.user_id, table.sample_id],
		}),
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "sample_views_user_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.sample_id],
			foreignColumns: [legacySamples.id],
			name: "sample_views_sample_id_fkey",
		}).onDelete("cascade"),
		index("ix_sample_views_user_id_viewed_at").on(
			table.user_id,
			table.viewed_at,
		),
	],
);

// One row per (user, analysis); see `sampleViews` for the upsert and cascade
// rationale.
export const analysisViews = pgTable(
	"analysis_views",
	{
		user_id: integer("user_id").notNull(),
		analysis_id: bigint("analysis_id", { mode: "number" }).notNull(),
		viewed_at: timestamp("viewed_at").notNull(),
	},
	(table) => [
		primaryKey({
			name: "analysis_views_pkey",
			columns: [table.user_id, table.analysis_id],
		}),
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: "analysis_views_user_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.analysis_id],
			foreignColumns: [analyses.id],
			name: "analysis_views_analysis_id_fkey",
		}).onDelete("cascade"),
		index("ix_analysis_views_user_id_viewed_at").on(
			table.user_id,
			table.viewed_at,
		),
	],
);

/** A row from the `sample_views` table. */
export type SampleViewRow = typeof sampleViews.$inferSelect;

/** A row from the `analysis_views` table. */
export type AnalysisViewRow = typeof analysisViews.$inferSelect;
