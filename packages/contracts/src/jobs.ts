import { z } from "zod";
import type { UserNested } from "./users";
import { WorkflowName } from "./workflowName";

/** A job's lifecycle state. Shared by every resource that embeds a job. */
export type JobState =
	| "cancelled"
	| "failed"
	| "pending"
	| "running"
	| "succeeded";

/** A workflow a job can run. */
export type JobWorkflow =
	| "build_index"
	| "create_sample"
	| "create_subtraction"
	| "nuvs"
	| "pathoscope";

/** A job embedded in another resource, e.g. a sample's creation job. */
export type JobNested = {
	createdAt: string;
	id: number;
	progress: number;
	state: JobState;
	user: UserNested;
	workflow: JobWorkflow;
};

/** Job row returned by the lifecycle endpoints. Provisional shape. */
export const Job = z.object({
	id: z.int(),
	workflow: WorkflowName,
	analysisId: z.string(),
	sampleId: z.string(),
	indexId: z.string(),
	subtractionIds: z.array(z.string()),
});

export type Job = z.infer<typeof Job>;

/** Body for `POST /jobs/claim` — runner narrows to its workflow image's pool. */
export const JobClaimRequest = z.object({
	workflows: z.array(WorkflowName).min(1),
});

export type JobClaimRequest = z.infer<typeof JobClaimRequest>;

/** Response body for `POST /jobs/claim` — the claimed job plus the one-time BasicAuth key. */
export const JobClaimResponse = z.object({
	job: Job,
	key: z.string(),
});

export type JobClaimResponse = z.infer<typeof JobClaimResponse>;

/** Body for `POST /jobs/{id}/steps/{step_id}/start`. Empty until a field is needed. */
export const JobStepStartRequest = z.object({});

export type JobStepStartRequest = z.infer<typeof JobStepStartRequest>;

/** Response for `POST /jobs/{id}/steps/{step_id}/start`. Empty until a field is needed. */
export const JobStepStartResponse = z.object({});

export type JobStepStartResponse = z.infer<typeof JobStepStartResponse>;

/** Response for `PUT /jobs/{id}/ping` — carries the cancellation signal back to the runner. */
export const JobPingResponse = z.object({
	cancelled: z.boolean(),
});

export type JobPingResponse = z.infer<typeof JobPingResponse>;

/** Body for `POST /jobs/{id}/finish` (success terminal transition only — failure is API-side). */
export const JobFinishRequest = z.object({});

export type JobFinishRequest = z.infer<typeof JobFinishRequest>;
