// Schema for the `runs` and `run_entries` tables.

import type { LibraryType, RunOrigin } from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { instruments } from "./instruments";
import { legacySamples } from "./samples";
import { users } from "./users";

export const runs = pgTable(
	"runs",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		// Whether new samples are created as the run's files arrive.
		autoCreate: boolean("auto_create").notNull(),
		createdAt: timestamp("created_at").notNull(),
		flowcell: text("flowcell"),
		// The group given to samples the run creates.
		groupId: integer("group_id"),
		instrumentId: integer("instrument_id"),
		// The library type given to samples the run creates.
		libraryType: text("library_type").$type<LibraryType>().notNull(),
		name: text("name").notNull(),
		origin: text("origin").$type<RunOrigin>().notNull(),
		runNumber: integer("run_number"),
		technicianId: integer("technician_id"),
		updatedAt: timestamp("updated_at").notNull(),
		userId: integer("user_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "runs_group_id_fkey",
		}).onDelete("set null"),
		foreignKey({
			columns: [table.instrumentId],
			foreignColumns: [instruments.id],
			name: "runs_instrument_id_fkey",
		}),
		foreignKey({
			columns: [table.technicianId],
			foreignColumns: [users.id],
			name: "runs_technician_id_fkey",
		}).onDelete("set null"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "runs_user_id_fkey",
		}),
		unique("runs_identity_key").on(
			table.instrumentId,
			table.runNumber,
			table.flowcell,
		),
		// A declared run has no identity until its first file arrives, then has
		// all of it at once.
		check(
			"ck_runs_identity_complete",
			sql`(${table.instrumentId} is null) = (${table.runNumber} is null) and (${table.runNumber} is null) = (${table.flowcell} is null)`,
		),
		check(
			"ck_runs_detected_identity",
			sql`${table.origin} <> 'detected' or ${table.instrumentId} is not null`,
		),
		check("ck_runs_origin", sql`${table.origin} in ('declared', 'detected')`),
		check(
			"ck_runs_library_type",
			sql`${table.libraryType} in ('amplicon', 'normal', 'other', 'srna')`,
		),
		index("ix_runs_group_id").on(table.groupId),
		index("ix_runs_technician_id").on(table.technicianId),
		index("ix_runs_user_id").on(table.userId),
	],
);

/** A row from the `runs` table. */
export type RunRow = typeof runs.$inferSelect;

// One sample sheet entry of a declared run. Lane rows for one `Sample_ID` are
// collapsed into a single entry.
export const runEntries = pgTable(
	"run_entries",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		// Set by the conditional update that wins the right to create the sample.
		claimedAt: timestamp("claimed_at"),
		// Why the entry's sample could not be created.
		error: text("error"),
		index: text("index"),
		index2: text("index2"),
		runId: integer("run_id").notNull(),
		sampleId: bigint("sample_id", { mode: "number" }),
		sampleName: text("sample_name"),
		sampleProject: text("sample_project"),
		// The sheet's `Sample_ID`, which BCL Convert writes into the filenames.
		sheetSampleId: text("sheet_sample_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.runId],
			foreignColumns: [runs.id],
			name: "run_entries_run_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.sampleId],
			foreignColumns: [legacySamples.id],
			name: "run_entries_sample_id_fkey",
		}).onDelete("set null"),
		unique("run_entries_run_id_sheet_sample_id_key").on(
			table.runId,
			table.sheetSampleId,
		),
	],
);

/** A row from the `run_entries` table. */
export type RunEntryRow = typeof runEntries.$inferSelect;
