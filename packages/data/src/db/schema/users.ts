// Read-only mirror of the `users` table managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns we touch (`id`, `handle`, `password`, `active`, `force_reset`,
// `last_password_change`) in sync with
// `../../../../../../virtool/virtool/users/pg.py`.

import type { AdministratorRoleName } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	customType,
	jsonb,
	pgTable,
	serial,
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
		id: serial("id").primaryKey(),
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
