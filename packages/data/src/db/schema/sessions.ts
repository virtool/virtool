// Read-only mirror of the `sessions` table managed by the upstream Python
// service via Alembic. Do not generate or push migrations from this side. Keep
// columns in sync with `../../../../../../virtool/virtool/sessions/models.py`.

import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const sessionType = pgEnum("session_type_enum", [
	"anonymous",
	"authenticated",
	"reset",
]);

export const sessions = pgTable("sessions", {
	id: serial("id").primaryKey(),
	sessionId: text("session_id").notNull().unique(),
	userId: integer("user_id").references(() => users.id, {
		onDelete: "cascade",
	}),
	ip: text("ip").notNull(),
	createdAt: timestamp("created_at").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	tokenHash: text("token_hash"),
	resetCode: text("reset_code"),
	resetRemember: boolean("reset_remember"),
	sessionType: sessionType("session_type").notNull(),
});

/** A row from the `sessions` table. */
export type SessionRow = typeof sessions.$inferSelect;
