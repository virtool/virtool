// Schema for the `instruments` and `instrument_groups` tables.

import {
	foreignKey,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";

export const instruments = pgTable(
	"instruments",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		createdAt: timestamp("created_at").notNull(),
		model: text("model"),
		name: text("name").notNull(),
		serial: text("serial").notNull(),
	},
	(table) => [unique("instruments_serial_key").on(table.serial)],
);

/** A row from the `instruments` table. */
export type InstrumentRow = typeof instruments.$inferSelect;

// The groups owning an instrument. An instrument with no rows here is open to
// everyone.
export const instrumentGroups = pgTable(
	"instrument_groups",
	{
		instrumentId: integer("instrument_id").notNull(),
		groupId: integer("group_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.instrumentId],
			foreignColumns: [instruments.id],
			name: "instrument_groups_instrument_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "instrument_groups_group_id_fkey",
		}).onDelete("cascade"),
		primaryKey({
			name: "instrument_groups_pkey",
			columns: [table.instrumentId, table.groupId],
		}),
	],
);
