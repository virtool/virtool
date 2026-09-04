// Schema for the `users` table.

import type {
	AccountLifecycleState,
	AdministratorRoleName,
} from "@virtool/contracts";
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
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		displayUsername: text("display_username"),
		email: text("email")
			.$defaultFn(() => "")
			.notNull(),
		emailVerified: boolean("email_verified").notNull().default(false),
		forceReset: boolean("force_reset")
			.$defaultFn(() => false)
			.notNull(),
		handle: text("handle").notNull(),
		image: text("image"),
		lastPasswordChange: timestamp("last_password_change").notNull(),
		legacyId: text("legacy_id"),
		// A real database default rather than a `$defaultFn`, because the
		// migration that adds the column has to backfill every existing row and
		// because an account is pending only when something says so.
		lifecycleState: text("lifecycle_state")
			.$type<AccountLifecycleState>()
			.notNull()
			.default("normal"),
		name: text("name").notNull().default(""),
		// Null while an account is pending: it exists, but nothing can sign in
		// as it yet. Every reader treats null as "no credential" and answers the
		// same way it answers a wrong password.
		password: bytea("password"),
		settings: jsonb("settings").$type<Record<string, unknown>>().notNull(),
		twoFactorEnabled: boolean("two_factor_enabled"),
		updatedAt: timestamp("updated_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		username: text("username"),
	},
	(table) => [
		unique("users_legacy_id_key").on(table.legacyId),
		unique("users_username_key").on(table.username),
		uniqueIndex("users_handle_lower_unique").on(lower(table.handle)),
		check(
			"administrator_role_valid",
			sql`${table.administratorRole} in ('full', 'settings', 'users', 'base')`,
		),
		check(
			"lifecycle_state_valid",
			sql`${table.lifecycleState} in ('pending', 'normal')`,
		),
		// A pending account holds no credential. Stated as a database rule
		// because a pending row carrying a password is a row that can sign in
		// before it has completed setup.
		//
		// One-directional on purpose: a `normal` account has a password today,
		// but once Better Auth owns credentials outright `users.password` becomes
		// dead weight for accounts that never had a legacy one, and this must not
		// stand in the way of clearing it.
		check(
			"pending_has_no_password",
			sql`${table.lifecycleState} <> 'pending' or ${table.password} is null`,
		),
	],
);

/** A row from the `users` table. */
export type UserRow = typeof users.$inferSelect;
