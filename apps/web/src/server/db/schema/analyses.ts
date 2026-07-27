// Partial read-only mirror of the `analyses` table managed by the upstream
// Python service via Alembic. Only the columns needed here are declared — to
// reconstruct a job's `args`, and to derive and filter samples by their
// workflow tags. Keep in sync with
// `../../../../../../virtool/virtool/analyses/sql.py`.

import { bigint, boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

export const analyses = pgTable("analyses", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	legacy_id: text("legacy_id").unique(),
	job_id: integer("job_id"),
	sample_id: bigint("sample_id", { mode: "number" }),
	workflow: text("workflow").notNull(),
	ready: boolean("ready").notNull(),
});
