// Read-only mirror of the `jobs` table, managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns in sync with `../../../../../../virtool/virtool/jobs/pg.py`.
//
// The legacy Mongo `args` field is not a column. A job's resources are all
// found on the owning rows via a reverse `job_id` foreign key —
// `legacy_samples.job_id`, `indexes.job_id`, `subtractions.job_id`, and
// `analyses.job_id` — and recombined into `args` when a job is read. The
// `job_analyses` and `job_indexes` link tables upstream are superseded by those
// reverse foreign keys and nothing reads or writes a link row; they are
// mirrored in `./vestigial.ts` for snapshot fidelity alone.
//
// The two JSONB columns are typed with the `Stored*` shapes from
// `@virtool/contracts`, which is where the mappers that publish them live. A
// local copy of either would be free to disagree with the mapper reading it.

import type {
	JobState,
	StoredJobClaim,
	StoredJobStep,
} from "@virtool/contracts";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const jobs = pgTable(
	"jobs",
	{
		id: serial("id").primaryKey(),
		// `.default()`, not `$defaultFn()`: this is the one column here that really
		// does carry a server default upstream, so the generated test DDL has to
		// carry it too or a raw insert omitting it fails only under test.
		acquired: boolean("acquired").default(false).notNull(),
		claim: jsonb("claim").$type<StoredJobClaim>(),
		claimed_at: timestamp("claimed_at"),
		created_at: timestamp("created_at").notNull(),
		finished_at: timestamp("finished_at"),
		key: text("key"),
		legacy_id: text("legacy_id"),
		pinged_at: timestamp("pinged_at"),
		state: text("state").$type<JobState>().notNull(),
		steps: jsonb("steps").$type<StoredJobStep[]>(),
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
		// Deliberately left open. Python's `Workflow` is an application-level enum
		// with no CHECK constraint behind it, so a row can hold a workflow this
		// build has never heard of.
		workflow: text("workflow").notNull(),
	},
	(table) => [
		unique("jobs_legacy_id_key").on(table.legacy_id),
		index("ix_jobs_state_created_at").on(table.state, table.created_at),
		index("ix_jobs_user_id_state").on(table.user_id, table.state),
		index("ix_jobs_workflow_state").on(table.workflow, table.state),
		check(
			"ck_jobs_state",
			sql`${table.state} in ('pending', 'running', 'cancelled', 'failed', 'succeeded')`,
		),
	],
);

/** A row from the `jobs` table. */
export type JobRow = typeof jobs.$inferSelect;
