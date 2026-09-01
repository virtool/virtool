import type { EmailTemplate } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

/** The delivery state of an email outbox row. */
export type EmailOutboxStatus = "queued" | "accepted" | "failed";

export const emailOutbox = pgTable(
	"email_outbox",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		accepted_at: timestamp("accepted_at"),
		attempt_count: integer("attempt_count").notNull(),
		claim_expires_at: timestamp("claim_expires_at"),
		claim_token: text("claim_token"),
		created_at: timestamp("created_at").notNull(),
		idempotency_key: text("idempotency_key").notNull(),
		last_error: text("last_error"),
		next_attempt_at: timestamp("next_attempt_at").notNull(),
		provider_message_id: text("provider_message_id"),
		recipient: text("recipient").notNull(),
		status: text("status").$type<EmailOutboxStatus>().notNull(),
		template: jsonb("template").$type<EmailTemplate>().notNull(),
		template_version: integer("template_version").notNull(),
		terminal_at: timestamp("terminal_at"),
	},
	(table) => [
		unique("uq_email_outbox_idempotency_key").on(table.idempotency_key),
		check(
			"ck_email_outbox_status",
			sql`${table.status} in ('queued', 'accepted', 'failed')`,
		),
		check("ck_email_outbox_attempt_count", sql`${table.attempt_count} >= 0`),
		index("idx_email_outbox_due")
			.on(table.next_attempt_at)
			.where(sql`${table.status} = 'queued'`),
		index("idx_email_outbox_terminal")
			.on(table.terminal_at)
			.where(sql`${table.status} in ('accepted', 'failed')`),
	],
);

/** A row from the `email_outbox` table. */
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
