// Schema for the Better Auth tables.
//
// Better Auth owns interactive human authentication: credential accounts,
// browser sessions, verification challenges, TOTP enrollment, and passkeys.
// It does not own the legacy `sessions` table, which still carries the current
// cookie pair and is left untouched here.
//
// Every table is keyed by an `integer ... generated always as identity` primary
// key rather than the string ids Better Auth mints by default. Better Auth 1.6
// decides that instance-wide through one `advanced.database.generateId`
// setting: only `"serial"` makes it leave ids to the database and type them as
// numbers, which is what keeps `users.id` the integer every domain foreign key
// and wire contract already references. There is no per-model switch, so the
// auxiliary tables take the same key type.
//
// A Drizzle property name here is a Better Auth *field* name, and the string
// passed to each column builder is the Postgres column. The Drizzle adapter
// looks a field up by its property name, so `userId` and `credentialID` must
// keep their exact spelling even though their columns are snake_case.

import {
	boolean,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const authAccounts = pgTable(
	"auth_accounts",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: integer("user_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_accounts_user_id_fkey",
		}).onDelete("cascade"),
		// Better Auth resolves a credential by (providerId, accountId), and the
		// legacy migration derives one `credential` account per user from that
		// user's id. Pinning the pair unique is what makes "one per user" a
		// database rule rather than a convention the migration has to hold to.
		unique("auth_accounts_provider_id_account_id_key").on(
			table.providerId,
			table.accountId,
		),
		index("idx_auth_accounts_user_id").on(table.userId),
	],
);

/** A row from the `auth_accounts` table. */
export type AuthAccountRow = typeof authAccounts.$inferSelect;

export const authSessions = pgTable(
	"auth_sessions",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: integer("user_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_sessions_user_id_fkey",
		}).onDelete("cascade"),
		unique("auth_sessions_token_key").on(table.token),
		index("idx_auth_sessions_user_id").on(table.userId),
	],
);

/** A row from the `auth_sessions` table. */
export type AuthSessionRow = typeof authSessions.$inferSelect;

export const authVerifications = pgTable(
	"auth_verifications",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at").notNull(),
	},
	(table) => [index("idx_auth_verifications_identifier").on(table.identifier)],
);

/** A row from the `auth_verifications` table. */
export type AuthVerificationRow = typeof authVerifications.$inferSelect;

export const authTwoFactors = pgTable(
	"auth_two_factors",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: integer("user_id").notNull(),
		verified: boolean("verified").notNull().default(true),
		failedVerificationCount: integer("failed_verification_count")
			.notNull()
			.default(0),
		lockedUntil: timestamp("locked_until"),
	},
	(table) => [
		// Better Auth's two-factor schema declares no delete behaviour, so the
		// cascade is stated here: a deleted user must not leave their TOTP secret
		// and recovery codes behind.
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_two_factors_user_id_fkey",
		}).onDelete("cascade"),
		index("idx_auth_two_factors_secret").on(table.secret),
		index("idx_auth_two_factors_user_id").on(table.userId),
	],
);

/** A row from the `auth_two_factors` table. */
export type AuthTwoFactorRow = typeof authTwoFactors.$inferSelect;

export const authPasskeys = pgTable(
	"auth_passkeys",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: integer("user_id").notNull(),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: boolean("backed_up").notNull(),
		transports: text("transports"),
		createdAt: timestamp("created_at"),
		aaguid: text("aaguid"),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_passkeys_user_id_fkey",
		}).onDelete("cascade"),
		index("idx_auth_passkeys_credential_id").on(table.credentialID),
		index("idx_auth_passkeys_user_id").on(table.userId),
	],
);

/** A row from the `auth_passkeys` table. */
export type AuthPasskeyRow = typeof authPasskeys.$inferSelect;
