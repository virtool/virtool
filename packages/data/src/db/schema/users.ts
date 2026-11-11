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
import { lowerTrim } from "./sql";

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
		authMigratedAt: timestamp("auth_migrated_at"),
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		email: text("email")
			.$defaultFn(() => "")
			.notNull(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		lastPasswordChange: timestamp("last_password_change").notNull(),
		// Holds the date of the newest changelog entry the user has seen, not the
		// time they saw it. Defaults to now so that no user starts with a backlog.
		lastSeenChangelogAt: timestamp("last_seen_changelog_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		legacyId: text("legacy_id"),
		// A real database default rather than a `$defaultFn`, because the
		// migration that adds the column has to backfill every existing row and
		// because an account is pending only when something says so.
		//
		// This is not `active`. Activation is the administrator's switch: a
		// deactivated account is unusable in any state, and completing setup
		// activates nobody. A reader that assumes a usable account checks both.
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
		// The only name a user has, stored lowercase. Null exactly while an
		// account is pending, so the plain unique constraint never sees two
		// pending accounts as a collision.
		username: text("username"),
	},
	(table) => [
		unique("users_legacy_id_key").on(table.legacyId),
		unique("users_username_key").on(table.username),
		// Better Auth declares its email field unique, but this column is not
		// globally unique.
		//
		// Normalized email is unique among migrated identities only. A plain
		// unique index could not be created: legacy rows share the empty string
		// and hold duplicate addresses, which is the population the audit exists
		// to report. `auth_migrated_at` is null for every row when this index is
		// created, so the constraint starts empty and each reconciled user joins
		// it one at a time.
		uniqueIndex("users_migrated_email_unique")
			.on(lowerTrim(table.email))
			.where(
				sql`${table.authMigratedAt} is not null and btrim(${table.email}) <> ''`,
			),
		check(
			"administrator_role_valid",
			sql`${table.administratorRole} in ('full', 'settings', 'users', 'base')`,
		),
		check(
			"username_lowercase",
			sql`${table.username} = lower(${table.username})`,
		),
		check(
			"username_matches_lifecycle_state",
			sql`(${table.lifecycleState} = 'pending') = (${table.username} is null)`,
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
