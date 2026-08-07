// The jobs API's wire contract, shared by the routes in `apps/jobs-api` — the
// control plane for running jobs — and the workflow runtime's HTTP client,
// which is the only thing that calls them. Both sides import
// these schemas: the routes parse incoming bodies with the same shapes the
// runtime uses to build them, so a contract change is a type error on both
// sides in the same commit rather than a runtime 422 discovered in a lab.
//
// # Naming, both halves
//
// **Every field crossing this wire is camelCase** — `runnerId`, `pingedAt`,
// `runtimeVersion`, `nameOnDisk`. Both ends are code we own and ship together,
// and it is the convention the rest of this package already follows.
//
// **Row content is not the wire, and stays snake_case.** The elements of the
// `jobs.steps` JSONB array carry `started_at`; the stored `claim` blob carries
// `runner_id` / `runtime_version` / `workflow_version`; and anything inside an
// analysis `results` blob keeps whatever the workflow wrote (`full_e`,
// `best_bias`, `best_score` on a NuVs ORF hit). Python reads and writes those
// same bytes, so they must not be "fixed" into camelCase.
//
// `JobStep` and `JobClaim` therefore exist in two spellings: the wire shapes
// here, and `StoredJobStep` / `StoredJobClaim` below for the JSONB elements,
// with mappers between them. **A route must never return a JSONB element
// straight out of the column** — that leaks `started_at` onto the wire and is
// the single most likely way this rule gets broken in practice.
//
// # Endpoint surface
//
// Paths carry no prefix. The jobs API is its own app serving no SPA, so
// nothing collides with the SPA's own `/jobs/{jobId}` route and these match
// Python's byte for byte.
//
//   POST   /jobs/claim                         CreateJobClaimRequest -> JobClaimed     (200 | 404 no job available)
//   GET    /jobs/{jobId}                       -                     -> Job            (200 | 404)
//   POST   /jobs/{jobId}/steps/{stepId}/start  StartJobStepRequest   -> JobStepStarted (200 | 404 | 409)
//   PUT    /jobs/{jobId}/ping                  -                     -> JobPing        (200 | 404)
//   POST   /jobs/{jobId}/finish                -                     -> Job            (200 | 404 | 409)
//   PATCH  /samples/{id}                       FinalizeSampleRequest      -> Sample
//   PATCH  /subtractions/{id}                  FinalizeSubtractionRequest -> Subtraction
//   PATCH  /analyses/{id}                      FinalizeAnalysisRequest    -> Analysis
//   GET    /caches/{key}                       -                     -> Cache           (200 | 404)
//   POST   /caches                             RegisterCacheRequest  -> CacheRegistered (201 | 200)
//
// The cache shapes live in `./caches` rather than here, because they are the one
// part of this surface a workflow reaches on its own behalf rather than on
// behalf of a job it is finishing.
//
// The workflow to claim is a query parameter on `POST /jobs/claim`, not a body
// field, matching Python's `ClaimJobView`.
//
// **Failure is API-side, not runner-side.** There is deliberately no "fail"
// endpoint: `POST /jobs/{jobId}/finish` is a success-only terminal transition,
// and a job fails by timing out on `ping` or by being cancelled. That asymmetry
// is the first thing a reader assumes is an omission, so it is written down
// here.
//
// Python also declares `JobWithKey(Job)` for the same idea `JobClaimed` covers.
// This side declares only `JobClaimed`: the key is minted once, at claim time,
// and no read endpoint ever carries it, so a second key-bearing shape would
// only invite one to.

import { z } from "zod";
import { AnalysisFormat } from "./analyses";
import { JobState, JobWorkflow } from "./jobs";
import { JsonObject } from "./json";
import { Quality } from "./samples";
import { NucleotideComposition } from "./subtractions";
import { UserNested } from "./users";

// Python serialises `datetime` to an ISO-8601 string, so every timestamp on this
// wire is a string. `z.date()` would reject the JSON the wire actually carries,
// and a strict datetime format check would couple us to Python's exact
// serialiser for no gain — the value is passed through to Postgres, which is the
// thing that actually validates it.
const timestamp = z.string();

/** A workflow step as the runner declares it at claim time. The runner owns its own step list. */
export const JobStepDefinition = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

export type JobStepDefinition = z.infer<typeof JobStepDefinition>;

/** A workflow step as the jobs API returns it. Persisted with `started_at`. */
export const JobStep = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	startedAt: timestamp.nullable(),
});

export type JobStep = z.infer<typeof JobStep>;

/** Response to `POST /jobs/{jobId}/steps/{stepId}/start` — the step, now started. */
export const JobStepStarted = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	startedAt: timestamp,
});

export type JobStepStarted = z.infer<typeof JobStepStarted>;

/**
 * Body for `POST /jobs/{jobId}/steps/{stepId}/start`.
 *
 * Genuinely empty, and expected to stay that way: the step id comes from the
 * path and the start time is the jobs API's to assign, not the runner's.
 */
export const StartJobStepRequest = z.object({});

export type StartJobStepRequest = z.infer<typeof StartJobStepRequest>;

/** A runner's claim metadata as it crosses the wire. Persisted as {@link StoredJobClaim}. */
export const JobClaim = z.object({
	runnerId: z.string(),
	mem: z.number(),
	cpu: z.number(),
	image: z.string(),
	runtimeVersion: z.string(),
	workflowVersion: z.string(),
});

export type JobClaim = z.infer<typeof JobClaim>;

/** Body for `POST /jobs/claim` — the runner's metadata plus the steps it will run. */
export const CreateJobClaimRequest = JobClaim.extend({
	steps: z.array(JobStepDefinition),
});

export type CreateJobClaimRequest = z.infer<typeof CreateJobClaimRequest>;

/** Response to `POST /jobs/claim` — the claimed job and its one-time runner key. */
export const JobClaimed = z.object({
	id: z.number().int(),
	acquired: z.boolean(),
	claim: JobClaim,
	claimedAt: timestamp,
	createdAt: timestamp,

	/**
	 * The plaintext runner key, used to authenticate every subsequent request for
	 * this job over HTTP Basic.
	 *
	 * Returned **only here, at claim time, and never again** — no read endpoint
	 * carries it. A runner that loses it cannot recover it and cannot finish its
	 * job; the job fails by ping timeout instead.
	 */
	key: z.string(),

	state: JobState,
	steps: z.array(JobStep),
	user: UserNested,
	workflow: JobWorkflow,
});

export type JobClaimed = z.infer<typeof JobClaimed>;

/** A job as the lifecycle endpoints return it. */
export const Job = z.object({
	id: z.number().int(),

	/**
	 * The workflow's argument blob, straight out of a JSONB column and not
	 * interpreted at this boundary. Its interior keys are row content — whatever
	 * Python wrote — and the camelCase rule does not reach inside an opaque blob.
	 */
	args: JsonObject,

	claim: JobClaim.nullable(),
	claimedAt: timestamp.nullable(),
	createdAt: timestamp,
	pingedAt: timestamp.nullable(),
	progress: z.number().int(),
	state: JobState,
	steps: z.array(JobStep).nullable(),
	user: UserNested,
	workflow: JobWorkflow,
});

export type Job = z.infer<typeof Job>;

/** Response to `PUT /jobs/{jobId}/ping`. */
export const JobPing = z.object({
	/**
	 * Whether the job has been cancelled.
	 *
	 * This is the cancellation channel. A runner has no other way to learn it
	 * should stop: it reads this on every ping and tears down when it is true.
	 */
	cancelled: z.boolean(),

	pingedAt: timestamp,
});

export type JobPing = z.infer<typeof JobPing>;

/**
 * A {@link JobClaim} as it is stored in the `jobs.claim` JSONB column.
 *
 * snake_case, byte-compatible with what Python reads and writes. Never returned
 * from a route — map it with {@link fromStoredJobClaim} first.
 */
export const StoredJobClaim = z.object({
	runner_id: z.string(),
	mem: z.number(),
	cpu: z.number(),
	image: z.string(),
	runtime_version: z.string(),
	workflow_version: z.string(),
});

export type StoredJobClaim = z.infer<typeof StoredJobClaim>;

/**
 * A {@link JobStep} as it is stored in the `jobs.steps` JSONB array.
 *
 * snake_case, byte-compatible with what Python reads and writes. Never returned
 * from a route — map it with {@link fromStoredJobStep} first.
 */
export const StoredJobStep = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	started_at: z.string().nullable(),
});

export type StoredJobStep = z.infer<typeof StoredJobStep>;

/** Maps a wire claim to the shape written to the `claim` JSONB column. */
export function toStoredJobClaim(claim: JobClaim): StoredJobClaim {
	return {
		runner_id: claim.runnerId,
		mem: claim.mem,
		cpu: claim.cpu,
		image: claim.image,
		runtime_version: claim.runtimeVersion,
		workflow_version: claim.workflowVersion,
	};
}

/** Maps a claim read out of the `claim` JSONB column to its wire shape. */
export function fromStoredJobClaim(stored: StoredJobClaim): JobClaim {
	return {
		runnerId: stored.runner_id,
		mem: stored.mem,
		cpu: stored.cpu,
		image: stored.image,
		runtimeVersion: stored.runtime_version,
		workflowVersion: stored.workflow_version,
	};
}

/** Maps a wire step to the shape written to the `steps` JSONB array. */
export function toStoredJobStep(step: JobStep): StoredJobStep {
	return {
		id: step.id,
		name: step.name,
		description: step.description,
		started_at: step.startedAt,
	};
}

/** Maps a step read out of the `steps` JSONB array to its wire shape. */
export function fromStoredJobStep(stored: StoredJobStep): JobStep {
	return {
		id: stored.id,
		name: stored.name,
		description: stored.description,
		startedAt: stored.started_at,
	};
}

const fileName = z.string().min(1);

// The complete object-storage key the workflow wrote to, minted with
// `mintStorageKey(domain, parentId)`. Structure and prefix are checked by the
// route against the resource in its own path — the schema only knows it is a
// non-empty string.
const storageKey = z.string().min(1);

/** A reads file a workflow wrote, to be registered in `sample_reads`. */
export const SampleReadManifest = z.object({
	kind: z.literal("sampleRead"),
	name: fileName,
	storageKey,
});

export type SampleReadManifest = z.infer<typeof SampleReadManifest>;

/** A file a workflow wrote, to be registered in `subtraction_files`. */
export const SubtractionFileManifest = z.object({
	kind: z.literal("subtractionFile"),
	name: fileName,
	storageKey,
});

export type SubtractionFileManifest = z.infer<typeof SubtractionFileManifest>;

/** A result file a workflow wrote, to be registered in `analysis_files`. */
export const AnalysisFileManifest = z.object({
	kind: z.literal("analysisFile"),
	name: fileName,
	storageKey,
	format: AnalysisFormat,
	description: z.string().nullable(),
});

export type AnalysisFileManifest = z.infer<typeof AnalysisFileManifest>;

/**
 * A file a workflow wrote to object storage and is declaring to the control
 * plane, which inserts the row.
 *
 * Under Python a workflow uploaded its outputs through the jobs API and the API
 * wrote both the bytes and the row. Workflows now have direct object-storage
 * access and write the bytes themselves, so they declare what they wrote instead.
 *
 * **The manifest carries the storage key, and the route records it verbatim.**
 * The alternative — composing the key server-side from ids the route already
 * holds — puts a second opinion about where the bytes went next to the writer's,
 * and the two are free to disagree. It buys nothing here either: the principal
 * is a workflow pod holding the same unscoped bucket credentials as every other
 * service, so a compromised one deletes directly rather than laundering a
 * deletion through a manifest. The route's guard is a prefix check against
 * `{domain}/{parentId}/` for the resource in its own path, which keeps the blast
 * radius of the uuid scheme without pretending to be a trust boundary.
 *
 * **It carries no size.** The row is written with the byte count the route read
 * back from storage, so a declared one would be a field nothing stores and
 * nothing checks. `name_on_disk` is likewise derived at the route.
 */
export const JobFileManifest = z.discriminatedUnion("kind", [
	SampleReadManifest,
	SubtractionFileManifest,
	AnalysisFileManifest,
]);

export type JobFileManifest = z.infer<typeof JobFileManifest>;

// The manifest rides along with the finalize call rather than arriving as a
// separate step, so a workflow cannot end in a state where the row exists and
// the file list does not. Each payload narrows the union to the variants its own
// domain can accept.

/** Body for `PATCH /samples/{id}` — the sample finalize call. */
export const FinalizeSampleRequest = z.object({
	quality: Quality,
	files: z.array(SampleReadManifest),
});

export type FinalizeSampleRequest = z.infer<typeof FinalizeSampleRequest>;

/** Body for `PATCH /subtractions/{id}` — the subtraction finalize call. */
export const FinalizeSubtractionRequest = z.object({
	count: z.number().int().nonnegative(),
	gc: NucleotideComposition,
	files: z.array(SubtractionFileManifest),
});

export type FinalizeSubtractionRequest = z.infer<
	typeof FinalizeSubtractionRequest
>;

/** Body for `PATCH /analyses/{id}` — the analysis finalize call. */
export const FinalizeAnalysisRequest = z.object({
	/**
	 * The workflow's output, an opaque JSONB blob interpreted only by the
	 * formatting layer. Its interior keys are the workflow's contract and stay
	 * exactly as it wrote them.
	 */
	results: JsonObject,

	files: z.array(AnalysisFileManifest),
});

export type FinalizeAnalysisRequest = z.infer<typeof FinalizeAnalysisRequest>;
