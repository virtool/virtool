import { JobState, JobWorkflow } from "@virtool/contracts";
import z from "zod";

export const JobNestedSchema = z.object({
	createdAt: z.coerce.date(),
	id: z.int(),
	progress: z.int(),
	state: JobState,
	user: z.object({
		handle: z.string(),
		id: z.int(),
	}),
	workflow: JobWorkflow,
});
// `createdAt` coerces from whatever the caller has on hand — a `Date` off the
// jobs endpoints, or the ISO string an embedded `JobNested` (from
// `@virtool/contracts`) carries — so the pre-parse and parsed shapes still
// diverge even with no field renamed.
export type ServerJobNested = z.input<typeof JobNestedSchema>;
export type JobNested = z.infer<typeof JobNestedSchema>;

export const JobMinimalSchema = z.object({
	id: z.int(),
	createdAt: z.coerce.date(),
	progress: z.int(),
	state: JobState,
	user: z.object({
		id: z.int(),
		handle: z.string(),
	}),
	workflow: JobWorkflow,
});

export type ServerJobMinimal = z.input<typeof JobMinimalSchema>;

// `started_at` reads the `jobs.steps` JSONB array, which Python co-writes and
// stays snake_case forever — see the wire-vs-row split documented on
// `StoredJobStep` in `@virtool/contracts`. Every other job field moved to
// camelCase with the data layer; this one and `JobClaimSchema` below cannot.
const JobStepSchema = z
	.object({
		description: z.string(),
		id: z.string(),
		name: z.string(),
		started_at: z.preprocess(
			(val) => (val ? new Date(val as string) : null),
			z.date().nullable(),
		),
	})
	.transform(({ id, name, description, started_at }) => ({
		id,
		name,
		description,
		startedAt: started_at,
	}));
export type JobStep = z.infer<typeof JobStepSchema>;

// `runner_id`/`runtime_version`/`workflow_version` read the `jobs.claim`
// JSONB blob, which Python co-writes and stays snake_case forever — same
// exception as `JobStepSchema` above.
const JobClaimSchema = z
	.object({
		cpu: z.number(),
		image: z.string(),
		mem: z.number(),
		runner_id: z.string(),
		runtime_version: z.string(),
		workflow_version: z.string(),
	})
	.transform(
		({ cpu, image, mem, runner_id, runtime_version, workflow_version }) => ({
			cpu,
			image,
			mem,
			runnerId: runner_id,
			runtimeVersion: runtime_version,
			workflowVersion: workflow_version,
		}),
	);
export const JobSchema = z.object({
	args: z.record(z.string(), z.unknown()),
	id: z.int(),
	claim: JobClaimSchema.nullish(),
	claimedAt: z.preprocess(
		(val) => (val ? new Date(val as string) : null),
		z.date().nullable(),
	),
	createdAt: z.coerce.date(),
	finishedAt: z.preprocess(
		(val) => (val ? new Date(val as string) : null),
		z.date().nullable(),
	),
	progress: z.int(),
	steps: z.array(JobStepSchema).nullable(),
	state: JobState,
	user: z.object({
		id: z.int(),
		handle: z.string(),
	}),
	workflow: JobWorkflow,
});
export type ServerJob = z.input<typeof JobSchema>;

const JobCountsSchema = z
	.record(z.string(), z.record(z.string(), z.number()))
	.transform((counts) => {
		const result: Partial<Record<JobState, number>> = {};
		for (const [state, stateCounts] of Object.entries(counts)) {
			result[state as JobState] = Object.values(stateCounts).reduce(
				(sum, count) => sum + count,
				0,
			);
		}
		return result as Record<JobState, number>;
	});

export type JobCounts = z.infer<typeof JobCountsSchema>;

export const JobSearchResultSchema = z.object({
	counts: JobCountsSchema,
	foundCount: z.number(),
	items: z.array(JobMinimalSchema),
	page: z.number(),
	pageCount: z.number(),
	perPage: z.number(),
	totalCount: z.number(),
});
