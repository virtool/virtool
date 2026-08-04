// Mirror of the `settings` table managed by the upstream Python service via
// Alembic. Do not generate or push migrations from this side. Keep the columns
// in sync with `../../../../../../virtool/virtool/settings/sql.py`.
//
// The table is a singleton: exactly one row, pinned to `id = 1`. Python seeds
// it in the `d16de6e24788` migration and re-seeds it at startup via
// `SettingsData.ensure()`. No column has a server default — the defaults live
// in Python's `Settings` model and are written into the row on insert, which is
// why `DEFAULT_SETTINGS` in `../../settings/data.ts` mirrors them rather than
// this file.

import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	integer,
	jsonb,
	pgTable,
	text,
} from "drizzle-orm/pg-core";

/** The group-access policies a newly created sample can be assigned. */
export const sampleGroups = [
	"none",
	"force_choice",
	"users_primary_group",
] as const;

/** The group-access policy applied to a newly created sample. */
export type SampleGroup = (typeof sampleGroups)[number];

export const settings = pgTable(
	"settings",
	{
		id: integer("id").primaryKey(),
		defaultSourceTypes: jsonb("default_source_types")
			.$type<string[]>()
			.notNull(),
		enableApi: boolean("enable_api").notNull(),
		enableSentry: boolean("enable_sentry").notNull(),
		minimumPasswordLength: integer("minimum_password_length").notNull(),
		sampleAllRead: boolean("sample_all_read").notNull(),
		sampleAllWrite: boolean("sample_all_write").notNull(),
		sampleGroup: text("sample_group").$type<SampleGroup>().notNull(),
		sampleGroupRead: boolean("sample_group_read").notNull(),
		sampleGroupWrite: boolean("sample_group_write").notNull(),
	},
	(table) => [
		check("ck_settings_singleton", sql`${table.id} = 1`),
		check(
			"ck_settings_sample_group",
			sql`${table.sampleGroup} in ('none', 'force_choice', 'users_primary_group')`,
		),
	],
);

/** A row from the `settings` table. */
export type SettingsRow = typeof settings.$inferSelect;
