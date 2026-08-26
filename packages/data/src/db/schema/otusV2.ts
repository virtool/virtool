import type {
	CreateLocalOtuCommand,
	OtuV2LineageTaxon,
} from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { referenceRoots } from "./referencesV2";
import { users } from "./users";

export const otusV2 = pgTable(
	"otus",
	{
		id: uuid("id").primaryKey(),
		referenceId: uuid("reference_id").notNull(),
		remoteId: uuid("remote_id"),
		moleculeType: text("molecule_type")
			.$type<"cRNA" | "DNA" | "mRNA" | "RNA" | "tRNA">()
			.notNull(),
		moleculeStrandedness: text("molecule_strandedness")
			.$type<"single" | "double">()
			.notNull(),
		moleculeTopology: text("molecule_topology")
			.$type<"linear" | "circular">()
			.notNull(),
		version: integer("version").notNull(),
		ncbiFromVersion: integer("ncbi_from_version"),
		deletedVersion: integer("deleted_version"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId],
			foreignColumns: [referenceRoots.id],
			name: "otus_reference_id_fkey",
		}),
		unique("otus_reference_id_id_key").on(table.referenceId, table.id),
		uniqueIndex("otus_reference_id_remote_id_key")
			.on(table.referenceId, table.remoteId)
			.where(sql`${table.remoteId} is not null`),
		check("otus_version_check", sql`${table.version} >= 1`),
		check(
			"otus_molecule_type_check",
			sql`${table.moleculeType} in ('cRNA', 'DNA', 'mRNA', 'RNA', 'tRNA')`,
		),
		check(
			"otus_molecule_strandedness_check",
			sql`${table.moleculeStrandedness} in ('single', 'double')`,
		),
		check(
			"otus_molecule_topology_check",
			sql`${table.moleculeTopology} in ('linear', 'circular')`,
		),
		check(
			"otus_ncbi_from_version_check",
			sql`${table.ncbiFromVersion} is null or ${table.ncbiFromVersion} between 1 and ${table.version}`,
		),
		check(
			"otus_deleted_version_check",
			sql`${table.deletedVersion} is null or ${table.deletedVersion} = ${table.version}`,
		),
	],
);

export const otuChanges = pgTable(
	"otu_changes",
	{
		id: bigint("id", { mode: "number" })
			.primaryKey()
			.generatedAlwaysAsIdentity(),
		referenceId: uuid("reference_id").notNull(),
		otuId: uuid("otu_id").notNull(),
		version: integer("version").notNull(),
		command: text("command").$type<"CreateOTU">().notNull(),
		commandSchemaVersion: integer("command_schema_version").notNull(),
		payload: jsonb("payload")
			.$type<CreateLocalOtuCommand["payload"]>()
			.notNull(),
		source: text("source")
			.$type<"user" | "system" | "remote" | "copy">()
			.notNull(),
		userId: integer("user_id"),
		remoteEventId: text("remote_event_id"),
		remoteAuthor: text("remote_author"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId, table.otuId],
			foreignColumns: [otusV2.referenceId, otusV2.id],
			name: "otu_changes_reference_id_otu_id_fkey",
		}),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "otu_changes_user_id_fkey",
		}),
		unique("otu_changes_otu_id_version_key").on(table.otuId, table.version),
		uniqueIndex("otu_changes_reference_id_remote_event_id_key")
			.on(table.referenceId, table.remoteEventId)
			.where(sql`${table.remoteEventId} is not null`),
		check(
			"otu_changes_command_schema_version_check",
			sql`${table.commandSchemaVersion} >= 1`,
		),
		check(
			"otu_changes_source_check",
			sql`${table.source} in ('user', 'system', 'remote', 'copy')`,
		),
	],
);

export const otuLocalIdentities = pgTable(
	"otu_local_identities",
	{
		id: uuid("id").primaryKey(),
		referenceId: uuid("reference_id").notNull(),
		otuId: uuid("otu_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId, table.otuId],
			foreignColumns: [otusV2.referenceId, otusV2.id],
			name: "otu_local_identities_reference_id_otu_id_fkey",
		}),
		unique("otu_local_identities_reference_id_otu_id_key").on(
			table.referenceId,
			table.otuId,
		),
		unique("otu_local_identities_reference_id_otu_id_id_key").on(
			table.referenceId,
			table.otuId,
			table.id,
		),
	],
);

export const otuLocalIdentityRevisions = pgTable(
	"otu_local_identity_revisions",
	{
		id: uuid("id").primaryKey(),
		referenceId: uuid("reference_id").notNull(),
		otuId: uuid("otu_id").notNull(),
		identityId: uuid("identity_id").notNull(),
		name: text("name").notNull(),
		acronym: text("acronym"),
		lineage: jsonb("lineage").$type<OtuV2LineageTaxon[]>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId, table.otuId, table.identityId],
			foreignColumns: [
				otuLocalIdentities.referenceId,
				otuLocalIdentities.otuId,
				otuLocalIdentities.id,
			],
			name: "otu_local_identity_revisions_reference_id_otu_id_identity_id_fkey",
		}),
		unique("otu_local_identity_revisions_reference_otu_id_key").on(
			table.referenceId,
			table.otuId,
			table.id,
		),
		check(
			"otu_local_identity_revisions_name_check",
			sql`btrim(${table.name}) <> ''`,
		),
		check(
			"otu_local_identity_revisions_acronym_check",
			sql`${table.acronym} is null or btrim(${table.acronym}) <> ''`,
		),
	],
);

export const otuTaxonomyVersions = pgTable(
	"otu_taxonomy_versions",
	{
		id: uuid("id").primaryKey(),
		referenceId: uuid("reference_id").notNull(),
		otuId: uuid("otu_id").notNull(),
		kind: text("kind").$type<"local" | "ncbi">().notNull(),
		localIdentityRevisionId: uuid("local_identity_revision_id"),
		lineageId: uuid("lineage_id"),
		firstVersion: integer("first_version").notNull(),
		lastVersion: integer("last_version"),
	},
	(table) => [
		foreignKey({
			columns: [table.referenceId, table.otuId],
			foreignColumns: [otusV2.referenceId, otusV2.id],
			name: "otu_taxonomy_versions_reference_id_otu_id_fkey",
		}),
		foreignKey({
			columns: [table.referenceId, table.otuId, table.localIdentityRevisionId],
			foreignColumns: [
				otuLocalIdentityRevisions.referenceId,
				otuLocalIdentityRevisions.otuId,
				otuLocalIdentityRevisions.id,
			],
			name: "otu_taxonomy_versions_reference_id_otu_id_local_identity_revision_id_fkey",
		}),
		uniqueIndex("otu_taxonomy_versions_current_key")
			.on(table.otuId)
			.where(sql`${table.lastVersion} is null`),
		check(
			"otu_taxonomy_versions_shape_check",
			sql`(${table.kind} = 'local' and ${table.localIdentityRevisionId} is not null and ${table.lineageId} is null) or (${table.kind} = 'ncbi' and ${table.localIdentityRevisionId} is null and ${table.lineageId} is not null)`,
		),
		checkVersionRange(
			table.firstVersion,
			table.lastVersion,
			"otu_taxonomy_versions",
		),
	],
);

export const otuPlans = pgTable(
	"otu_plans",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId],
			foreignColumns: [otusV2.id],
			name: "otu_plans_otu_id_fkey",
		}),
		unique("otu_plans_otu_id_key").on(table.otuId),
		unique("otu_plans_otu_id_id_key").on(table.otuId, table.id),
	],
);

export const otuPlanSegments = pgTable(
	"otu_plan_segments",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
		planId: uuid("plan_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId, table.planId],
			foreignColumns: [otuPlans.otuId, otuPlans.id],
			name: "otu_plan_segments_otu_id_plan_id_fkey",
		}),
		unique("otu_plan_segments_otu_id_id_key").on(table.otuId, table.id),
	],
);

export const otuPlanSegmentVersions = pgTable(
	"otu_plan_segment_versions",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
		segmentId: uuid("segment_id").notNull(),
		namePrefix: text("name_prefix"),
		nameKey: text("name_key"),
		length: integer("length").notNull(),
		lengthTolerance: doublePrecision("length_tolerance").notNull(),
		rule: text("rule")
			.$type<"required" | "recommended" | "optional">()
			.notNull(),
		firstVersion: integer("first_version").notNull(),
		lastVersion: integer("last_version"),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId, table.segmentId],
			foreignColumns: [otuPlanSegments.otuId, otuPlanSegments.id],
			name: "otu_plan_segment_versions_otu_id_segment_id_fkey",
		}),
		uniqueIndex("otu_plan_segment_versions_current_key")
			.on(table.otuId, table.segmentId)
			.where(sql`${table.lastVersion} is null`),
		index("otu_plan_segment_versions_otu_id_idx").on(table.otuId),
		check("otu_plan_segment_versions_length_check", sql`${table.length} > 0`),
		check(
			"otu_plan_segment_versions_tolerance_check",
			sql`${table.lengthTolerance} between 0 and 1`,
		),
		check(
			"otu_plan_segment_versions_name_check",
			sql`(${table.namePrefix} is null and ${table.nameKey} is null) or (${table.namePrefix} is not null and ${table.nameKey} is not null)`,
		),
		check(
			"otu_plan_segment_versions_rule_check",
			sql`${table.rule} in ('required', 'recommended', 'optional')`,
		),
		checkVersionRange(
			table.firstVersion,
			table.lastVersion,
			"otu_plan_segment_versions",
		),
	],
);

export const otuIsolates = pgTable(
	"otu_isolates",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId],
			foreignColumns: [otusV2.id],
			name: "otu_isolates_otu_id_fkey",
		}),
		unique("otu_isolates_otu_id_id_key").on(table.otuId, table.id),
	],
);

export const otuIsolateVersions = pgTable(
	"otu_isolate_versions",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
		isolateId: uuid("isolate_id").notNull(),
		nameType: text("name_type").$type<
			"isolate" | "strain" | "clone" | "variant" | "genotype" | "serotype"
		>(),
		nameValue: text("name_value"),
		firstVersion: integer("first_version").notNull(),
		lastVersion: integer("last_version"),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId, table.isolateId],
			foreignColumns: [otuIsolates.otuId, otuIsolates.id],
			name: "otu_isolate_versions_otu_id_isolate_id_fkey",
		}),
		uniqueIndex("otu_isolate_versions_current_key")
			.on(table.otuId, table.isolateId)
			.where(sql`${table.lastVersion} is null`),
		check(
			"otu_isolate_versions_name_check",
			sql`(${table.nameType} is null and ${table.nameValue} is null) or (${table.nameType} is not null and btrim(${table.nameValue}) <> '')`,
		),
		checkVersionRange(
			table.firstVersion,
			table.lastVersion,
			"otu_isolate_versions",
		),
	],
);

export const otuSequences = pgTable(
	"otu_sequences",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId],
			foreignColumns: [otusV2.id],
			name: "otu_sequences_otu_id_fkey",
		}),
		unique("otu_sequences_otu_id_id_key").on(table.otuId, table.id),
	],
);

export const otuLocalSequenceRecords = pgTable(
	"otu_local_sequence_records",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
		sequenceId: uuid("sequence_id").notNull(),
		definition: text("definition").notNull(),
		sequence: text("sequence").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId, table.sequenceId],
			foreignColumns: [otuSequences.otuId, otuSequences.id],
			name: "otu_local_sequence_records_otu_id_sequence_id_fkey",
		}),
		unique("otu_local_sequence_records_otu_sequence_id_key").on(
			table.otuId,
			table.sequenceId,
			table.id,
		),
		check(
			"otu_local_sequence_records_definition_check",
			sql`btrim(${table.definition}) <> ''`,
		),
		check(
			"otu_local_sequence_records_sequence_check",
			sql`${table.sequence} <> '' and ${table.sequence} ~ '^[ATCGNRYKMSWBDHV]+$'`,
		),
	],
);

export const otuSequenceVersions = pgTable(
	"otu_sequence_versions",
	{
		id: uuid("id").primaryKey(),
		otuId: uuid("otu_id").notNull(),
		sequenceId: uuid("sequence_id").notNull(),
		isolateId: uuid("isolate_id").notNull(),
		segmentId: uuid("segment_id").notNull(),
		localRecordId: uuid("local_record_id").notNull(),
		firstVersion: integer("first_version").notNull(),
		lastVersion: integer("last_version"),
	},
	(table) => [
		foreignKey({
			columns: [table.otuId, table.sequenceId],
			foreignColumns: [otuSequences.otuId, otuSequences.id],
			name: "otu_sequence_versions_otu_id_sequence_id_fkey",
		}),
		foreignKey({
			columns: [table.otuId, table.isolateId],
			foreignColumns: [otuIsolates.otuId, otuIsolates.id],
			name: "otu_sequence_versions_otu_id_isolate_id_fkey",
		}),
		foreignKey({
			columns: [table.otuId, table.segmentId],
			foreignColumns: [otuPlanSegments.otuId, otuPlanSegments.id],
			name: "otu_sequence_versions_otu_id_segment_id_fkey",
		}),
		foreignKey({
			columns: [table.otuId, table.sequenceId, table.localRecordId],
			foreignColumns: [
				otuLocalSequenceRecords.otuId,
				otuLocalSequenceRecords.sequenceId,
				otuLocalSequenceRecords.id,
			],
			name: "otu_sequence_versions_otu_id_sequence_id_local_record_id_fkey",
		}),
		uniqueIndex("otu_sequence_versions_current_key")
			.on(table.otuId, table.sequenceId)
			.where(sql`${table.lastVersion} is null`),
		index("otu_sequence_versions_otu_isolate_idx").on(
			table.otuId,
			table.isolateId,
		),
		checkVersionRange(
			table.firstVersion,
			table.lastVersion,
			"otu_sequence_versions",
		),
	],
);

function checkVersionRange(
	firstVersion: { name: string },
	lastVersion: { name: string },
	prefix: string,
) {
	return check(
		`${prefix}_version_range_check`,
		sql`${firstVersion} >= 1 and (${lastVersion} is null or ${lastVersion} > ${firstVersion})`,
	);
}

/** A row from `otus`. */
export type OtuV2Row = typeof otusV2.$inferSelect;

/** A row from `otu_changes`. */
export type OtuChangeRow = typeof otuChanges.$inferSelect;
