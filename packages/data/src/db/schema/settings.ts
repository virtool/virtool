// Schema for the `settings` table.
//
// The table is a singleton: exactly one row, pinned to `id = 1`. No column has
// a server default — every default is written into the row on insert, which
// is why `DEFAULT_SETTINGS` in `../../settings/data.ts` carries them rather
// than this file.

import type { SampleGroup } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	integer,
	jsonb,
	pgTable,
	text,
} from "drizzle-orm/pg-core";

export const settings = pgTable(
	"settings",
	{
		id: integer("id").primaryKey(),
		defaultSourceTypes: jsonb("default_source_types")
			.$type<string[]>()
			.notNull(),
		enableSentry: boolean("enable_sentry").notNull(),
		minimumPasswordLength: integer("minimum_password_length").notNull(),
		// A credential, unlike every other column here. It is never published to
		// a client: `apps/web/src/server/settings/functions.ts` reduces it to a
		// boolean at the transport boundary. Empty means unset, and the GenBank
		// request layer omits `api_key` rather than sending a blank one.
		ncbiApiKey: text("ncbi_api_key").notNull(),
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
