import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	doublePrecision,
	foreignKey,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { users } from "./users";

export const referenceRoots = pgTable(
	"reference_roots",
	{
		id: uuid("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		kind: text("kind").$type<"local" | "remote">().notNull(),
		remoteUrl: text("remote_url"),
		remoteCursor: text("remote_cursor"),
		defaultSegmentLengthTolerance: doublePrecision(
			"default_segment_length_tolerance",
		).notNull(),
		archived: boolean("archived")
			.$defaultFn(() => false)
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		check(
			"reference_roots_kind_check",
			sql`${table.kind} in ('local', 'remote')`,
		),
		check(
			"reference_roots_remote_shape_check",
			sql`(${table.kind} = 'local' and ${table.remoteUrl} is null and ${table.remoteCursor} is null) or (${table.kind} = 'remote' and ${table.remoteUrl} is not null)`,
		),
		check(
			"reference_roots_default_tolerance_check",
			sql`${table.defaultSegmentLengthTolerance} between 0 and 1`,
		),
	],
);

export const referenceUsers = pgTable(
	"reference_users",
	{
		referenceId: uuid("reference_id").notNull(),
		userId: integer("user_id").notNull(),
		build: boolean("build").notNull(),
		modify: boolean("modify").notNull(),
		modifyOtu: boolean("modify_otu").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId],
			foreignColumns: [referenceRoots.id],
			name: "reference_users_reference_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reference_users_user_id_fkey",
		}),
		primaryKey({
			name: "reference_users_pkey",
			columns: [table.referenceId, table.userId],
		}),
	],
);

export const referenceGroups = pgTable(
	"reference_groups",
	{
		referenceId: uuid("reference_id").notNull(),
		groupId: integer("group_id").notNull(),
		build: boolean("build").notNull(),
		modify: boolean("modify").notNull(),
		modifyOtu: boolean("modify_otu").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId],
			foreignColumns: [referenceRoots.id],
			name: "reference_groups_reference_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "reference_groups_group_id_fkey",
		}),
		primaryKey({
			name: "reference_groups_pkey",
			columns: [table.referenceId, table.groupId],
		}),
	],
);

/** A row from `reference_roots`. */
export type ReferenceRootRow = typeof referenceRoots.$inferSelect;

/** A row from `reference_users`. */
export type ReferenceUserV2Row = typeof referenceUsers.$inferSelect;
