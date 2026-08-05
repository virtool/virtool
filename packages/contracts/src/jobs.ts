import { z } from "zod";
import type { UserNested } from "./users";

/** A job's lifecycle state. Shared by every resource that embeds a job. */
export const JobState = z.enum([
	"cancelled",
	"failed",
	"pending",
	"running",
	"succeeded",
]);

export type JobState = z.infer<typeof JobState>;

/**
 * A workflow a job can run.
 *
 * This is the job *read* path and carries every member of Python's `Workflow`
 * enum, `build_index` included. That workflow stays Python-owned — the TypeScript
 * runtime ports the other four — but `build_index` rows exist in the `jobs`
 * table today, so a narrower union would fail to parse a job that is perfectly
 * valid. The jobs API instead refuses to hand out a `build_index` job at
 * claim time, which is a rule about who may run what, not about what a row may
 * contain.
 *
 * Analyses run a strictly narrower set; see `AnalysisWorkflow`.
 */
export const JobWorkflow = z.enum([
	"build_index",
	"create_sample",
	"create_subtraction",
	"nuvs",
	"pathoscope",
]);

export type JobWorkflow = z.infer<typeof JobWorkflow>;

/** A job embedded in another resource, e.g. a sample's creation job. */
export type JobNested = {
	createdAt: string;
	id: number;
	progress: number;
	state: JobState;
	user: UserNested;
	workflow: JobWorkflow;
};
