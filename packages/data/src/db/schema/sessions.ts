// Read-only mirror of the `sessions` table managed by the upstream Python
// service via Alembic. Do not generate or push migrations from this side. Keep
// columns in sync with `../../../../../../virtool/virtool/sessions/models.py`.

import type { SessionType } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const sessions = pgTable(
	"sessions",
	{
		id: serial("id").primaryKey(),
		sessionId: text("session_id").notNull(),
		userId: integer("user_id"),
		ip: text("ip").notNull(),
		createdAt: timestamp("created_at").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		tokenHash: text("token_hash"),
		resetCode: text("reset_code"),
		resetRemember: boolean("reset_remember"),
		sessionType: text("session_type").$type<SessionType>().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_fkey",
		}).onDelete("cascade"),
		unique("sessions_session_id_key").on(table.sessionId),
		index("idx_sessions_expires_at").on(table.expiresAt),
		uniqueIndex("idx_sessions_session_id").on(table.sessionId),
		index("idx_sessions_type").on(table.sessionType),
		index("idx_sessions_user_id").on(table.userId),
		check(
			"session_type_valid",
			sql`${table.sessionType} in ('anonymous', 'authenticated', 'reset')`,
		),
	],
);

/** A row from the `sessions` table. */
export type SessionRow = typeof sessions.$inferSelect;
