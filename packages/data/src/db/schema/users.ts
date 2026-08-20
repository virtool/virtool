// Schema for the `users` table.

import type { AdministratorRoleName } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	customType,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { lower } from "./sql";

const bytea = customType<{ data: Buffer; default: false }>({
	dataType() {
		return "bytea";
	},
});

export const users = pgTable(
	"users",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		active: boolean("active")
			.$defaultFn(() => true)
			.notNull(),
		administratorRole:
			text("administrator_role").$type<AdministratorRoleName>(),
		email: text("email")
			.$defaultFn(() => "")
			.notNull(),
		forceReset: boolean("force_reset")
			.$defaultFn(() => false)
			.notNull(),
		handle: text("handle").notNull(),
		lastPasswordChange: timestamp("last_password_change").notNull(),
		legacyId: text("legacy_id"),
		password: bytea("password").notNull(),
		settings: jsonb("settings").$type<Record<string, unknown>>().notNull(),
	},
	(table) => [
		unique("users_legacy_id_key").on(table.legacyId),
		uniqueIndex("users_handle_lower_unique").on(lower(table.handle)),
		check(
			"administrator_role_valid",
			sql`${table.administratorRole} in ('full', 'settings', 'users', 'base')`,
		),
	],
);

/** A row from the `users` table. */
export type UserRow = typeof users.$inferSelect;
