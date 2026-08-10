// Read-only mirror of the `jobs` table, managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns in sync with `../../../../../../virtool/virtool/jobs/pg.py`.
//
// The legacy Mongo `args` field is not a column. A job's resources are all
// found on the owning rows via a reverse `job_id` foreign key —
// `legacy_samples.job_id`, `indexes.job_id`, `subtractions.job_id`, and
// `analyses.job_id` — and recombined into `args` when a job is read. There are
// no `job_samples` / `job_indexes` junction tables: the sample and index are
// resolved through those reverse foreign keys, not link rows.
//
// The two JSONB columns are typed with the `Stored*` shapes from
// `@virtool/contracts`, which is where the mappers that publish them live. A
// local copy of either would be free to disagree with the mapper reading it.

import type {
	JobState,
	StoredJobClaim,
	StoredJobStep,
} from "@virtool/contracts";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	acquired: boolean("acquired").$defaultFn(() => false),
	claim: jsonb("claim").$type<StoredJobClaim>(),
	claimed_at: timestamp("claimed_at"),
	created_at: timestamp("created_at").notNull(),
	finished_at: timestamp("finished_at"),
	key: text("key"),
	legacy_id: text("legacy_id").unique(),
	pinged_at: timestamp("pinged_at"),
	// `text`, closed by the `ck_jobs_state` CHECK constraint. `$type` asserts
	// rather than validates, which is what that constraint makes safe: a value
	// outside the union cannot reach the column without a Python-side migration.
	state: text("state").$type<JobState>().notNull(),
	steps: jsonb("steps").$type<StoredJobStep[]>(),
	user_id: integer("user_id").notNull(),
	// Deliberately left open. Python's `Workflow` is an application-level enum
	// with no CHECK constraint behind it, so a row can hold a workflow this
	// build has never heard of.
	workflow: text("workflow").notNull(),
});

/** A row from the `jobs` table. */
export type JobRow = typeof jobs.$inferSelect;
