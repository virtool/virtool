// Schema for the `settings` table.
//
// The table is a singleton: exactly one row, pinned to `id = 1`. No column has
// a server default — every default is written into the row on insert, which
// is why `DEFAULT_SETTINGS` in `../../settings/data.ts` carries them rather
// than this file.

import { MAX_UPLOAD_SIZE, type SampleGroup } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	integer,
	jsonb,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import type { EncryptedValue } from "../../crypto/keyring";

export const settings = pgTable(
	"settings",
	{
		id: integer("id").primaryKey(),
		// The object-storage budget, in bytes, the LRU cache eviction task keeps
		// the cache store under. `mode: "number"` is safe up to 2^53, far above
		// any realistic budget.
		cacheStorageBudget: bigint("cache_storage_budget", {
			mode: "number",
		}).notNull(),
		defaultSourceTypes: jsonb("default_source_types")
			.$type<string[]>()
			.notNull(),
		// Encrypted under the environment-owned process encryption key.
		emailApiKey: jsonb("email_api_key").$type<EncryptedValue>(),
		emailEnabled: boolean("email_enabled").notNull(),
		emailReplyToAddress: text("email_reply_to_address").notNull(),
		emailSenderAddress: text("email_sender_address").notNull(),
		emailSenderName: text("email_sender_name").notNull(),
		enableSentry: boolean("enable_sentry").notNull(),
		// The upload limit in bytes fits within JavaScript's safe integer range.
		maxUploadSize: bigint("max_upload_size", { mode: "number" }).notNull(),
		minimumPasswordLength: integer("minimum_password_length").notNull(),
		// Encrypted under the environment-owned process encryption key. Null
		// means unset, and the GenBank request layer omits `api_key` rather than
		// sending a blank one.
		ncbiApiKey: jsonb("ncbi_api_key").$type<EncryptedValue>(),
		sampleAllRead: boolean("sample_all_read").notNull(),
		sampleAllWrite: boolean("sample_all_write").notNull(),
		sampleGroup: text("sample_group").$type<SampleGroup>().notNull(),
		sampleGroupRead: boolean("sample_group_read").notNull(),
		sampleGroupWrite: boolean("sample_group_write").notNull(),
	},
	(table) => [
		check("ck_settings_singleton", sql`${table.id} = 1`),
		check(
			"ck_settings_cache_storage_budget",
			sql`${table.cacheStorageBudget} > 0`,
		),
		check(
			"ck_settings_max_upload_size",
			sql`${table.maxUploadSize} > 0 AND ${table.maxUploadSize} <= ${sql.raw(String(MAX_UPLOAD_SIZE))}`,
		),
		check(
			"ck_settings_sample_group",
			sql`${table.sampleGroup} in ('none', 'force_choice', 'users_primary_group')`,
		),
	],
);

/** A row from the `settings` table. */
export type SettingsRow = typeof settings.$inferSelect;
