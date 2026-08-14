// Mirror of four tables that still exist in production and that nothing reads
// or writes — not this codebase, and not Python either.
//
// They are declared only so the schema snapshot describes production. A table
// missing from this schema is missing from the snapshot, so nothing could
// generate the migration that drops it — the same reasoning that keeps
// `analyses`' dead `reference` and `index` columns declared. Dropping them is
// a post-cutover cleanup, not something to do from here while Alembic still
// owns the schema.
//
// `permissions` is the furthest gone: it has no SQLAlchemy model upstream at
// all, and its two enum types are referenced by nothing in either repository.
// That is why their members are spelled out here rather than taken from
// `@virtool/contracts` — there is no shared contract, because there is no
// consumer to share one with.

import {
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	unique,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";

/** @public The `action` enum type, reachable only from `permissions.action`. */
export const action = pgEnum("action", [
	"create",
	"update",
	"delete",
	"modify",
	"remove",
]);

/** @public The `resourcetype` enum, reachable only from `permissions`. */
export const resourceType = pgEnum("resourcetype", ["app", "group"]);

/** @public A permission descriptor. Orphaned: no model upstream reads it. */
export const permissions = pgTable("permissions", {
	id: text("id").primaryKey(),
	name: text("name"),
	description: text("description"),
	resource_type: resourceType("resource_type"),
	action: action("action"),
});

/**
 * @public An analysis's results, split out of `analyses.results`.
 *
 * Upstream's own docstring calls the table temporary. `analyses.results` is
 * what every reader on both sides actually uses.
 */
export const analysisResults = pgTable(
	"analysis_results",
	{
		id: serial("id").primaryKey(),
		analysis_id: text("analysis_id").notNull(),
		results: jsonb("results").$type<Record<string, unknown>>().notNull(),
	},
	(table) => [unique("analysis_results_analysis_id_key").on(table.analysis_id)],
);

/*
 * `job_analyses` and `job_indexes` link a job to the resource it produced.
 * Both are superseded by the reverse `job_id` foreign keys on `analyses` and
 * `indexes`, which is what `getJob` recombines into a job's `args`. Each is
 * keyed on `job_id` alone, so a job links to at most one resource.
 */

/** @public Superseded by `analyses.job_id`. */
export const jobAnalyses = pgTable(
	"job_analyses",
	{
		job_id: integer("job_id")
			.notNull()
			.references(() => jobs.id),
		analysis_id: text("analysis_id").notNull(),
	},
	(table) => [
		primaryKey({ name: "job_analyses_pkey", columns: [table.job_id] }),
	],
);

/** @public Superseded by `indexes.job_id`. */
export const jobIndexes = pgTable(
	"job_indexes",
	{
		job_id: integer("job_id")
			.notNull()
			.references(() => jobs.id),
		index_id: text("index_id").notNull(),
	},
	(table) => [
		primaryKey({ name: "job_indexes_pkey", columns: [table.job_id] }),
	],
);
