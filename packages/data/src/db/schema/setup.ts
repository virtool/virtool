// Schema for the account-setup tables.
//
// Two separate credentials, because they answer different questions. A
// `setup_tokens` row is the bearer secret in a link an administrator copies or
// an email carries: it proves the holder was sent the link, and it is spent
// once. A `setup_sessions` row is the restricted browser credential the holder
// gets in exchange: it proves an in-progress setup for one named purpose and
// nothing else.
//
// Neither is the legacy `sessions` table and neither is `auth_sessions`. A
// restricted setup credential must not be an ordinary application session —
// the whole point is that it reaches only its own setup surface — so it is
// held apart rather than added as another `session_type`.

import type { SetupPurpose } from "@virtool/contracts";
import { type SQL, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * The SQL fragment closing a `purpose` column to the shared union.
 *
 * Written once because both tables carry the same column and the two must not
 * be able to disagree about what a purpose is.
 */
function purposeCheck(): SQL {
	return sql.raw(
		"purpose in ('account_completion', 'email_remediation', 'totp_enrollment')",
	);
}

export const setupTokens = pgTable(
	"setup_tokens",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		userId: integer("user_id").notNull(),
		purpose: text("purpose").$type<SetupPurpose>().notNull(),
		/**
		 * SHA-256 of the plaintext token, the only form it is ever stored in.
		 * The plaintext is returned to the issuing caller once and never again.
		 */
		tokenHash: text("token_hash").notNull(),
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		expiresAt: timestamp("expires_at").notNull(),
		/** When this token was spent. Null while it is still usable. */
		consumedAt: timestamp("consumed_at"),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "setup_tokens_user_id_fkey",
		}).onDelete("cascade"),
		// The digest is what a submission is looked up by, so it is unique and
		// indexed by the same constraint. A collision would be two users sharing
		// one link.
		unique("setup_tokens_token_hash_key").on(table.tokenHash),
		// The expiry sweep's index. It is the only query that scans the table
		// without a digest.
		index("idx_setup_tokens_expires_at").on(table.expiresAt),
		// Issuing a replacement supersedes the outstanding tokens for the same
		// user and purpose, which is the only lookup by user.
		index("idx_setup_tokens_user_id_purpose").on(table.userId, table.purpose),
		check("setup_tokens_purpose_valid", purposeCheck()),
	],
);

/** A row from the `setup_tokens` table. */
export type SetupTokenRow = typeof setupTokens.$inferSelect;

export const setupSessions = pgTable(
	"setup_sessions",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		/**
		 * The stable, non-secret identifier. Safe to log and to attribute an
		 * error to; it proves nothing on its own.
		 */
		sessionId: text("session_id").notNull(),
		/** SHA-256 of the secret half of the credential. */
		tokenHash: text("token_hash").notNull(),
		userId: integer("user_id").notNull(),
		purpose: text("purpose").$type<SetupPurpose>().notNull(),
		ip: text("ip").notNull(),
		createdAt: timestamp("created_at")
			.notNull()
			.default(sql`timezone('utc', now())`),
		expiresAt: timestamp("expires_at").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "setup_sessions_user_id_fkey",
		}).onDelete("cascade"),
		unique("setup_sessions_session_id_key").on(table.sessionId),
		index("idx_setup_sessions_expires_at").on(table.expiresAt),
		// Completing or abandoning setup revokes every restricted session the
		// user holds, so the whole set has to be reachable by user.
		index("idx_setup_sessions_user_id").on(table.userId),
		check("setup_sessions_purpose_valid", purposeCheck()),
	],
);

/** A row from the `setup_sessions` table. */
export type SetupSessionRow = typeof setupSessions.$inferSelect;
