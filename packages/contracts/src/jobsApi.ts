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
// `JobStep` / `JobClaim`, their `StoredJobStep` / `StoredJobClaim` column
// spellings and the mappers between them live in `./jobs`, not here. They are
// not this service's contract: the web app publishes the same two shapes to the
// SPA off the same column through the same mappers. **A route must never return
// a JSONB element straight out of the column** — that leaks `started_at` onto
// the wire and is the single most likely way this rule gets broken in practice.
//
// # Endpoint surface
//
// Paths carry no prefix. The jobs API is its own app serving no SPA, so
// nothing collides with the SPA's own `/jobs/{jobId}` route and these match
// Python's byte for byte.
//
//   POST   /jobs/claim                         CreateJobClaimRequest -> JobClaimed     (200 | 404 no job available | 422 unclaimable workflow)
//   GET    /jobs/{jobId}                       -                     -> Job            (200 | 401 | 403 | 404)
//   POST   /jobs/{jobId}/steps/{stepId}/start  StartJobStepRequest   -> JobStepStarted (200 | 401 | 403 | 404 | 409)
//   PUT    /jobs/{jobId}/ping                  -                     -> JobPing        (200 | 401 terminal | 403 | 404)
//   POST   /jobs/{jobId}/finish                -                     -> Job            (200 | 401 | 403 | 404 | 409)
//   PATCH  /samples/{id}                       FinalizeSampleRequest      -> Sample
//   PATCH  /subtractions/{id}                  FinalizeSubtractionRequest -> Subtraction
//   PATCH  /analyses/{id}                      FinalizeAnalysisRequest    -> Analysis
//   GET    /caches/{key}                       -                     -> Cache           (200 | 404)
//   POST   /caches                             RegisterCacheRequest  -> CacheRegistered (201 | 200)
//   GET    /samples/{id}                       -                     -> WorkflowSample       (200 | 404)
//   GET    /subtractions/{id}                  -                     -> WorkflowSubtraction  (200 | 404)
//   GET    /indexes/{id}                       -                     -> WorkflowIndex        (200 | 404)
//   GET    /analyses/{id}                      -                     -> WorkflowAnalysis     (200 | 404)
//   GET    /refs/{id}                          -                     -> WorkflowReference    (200 | 404)
//   GET    /settings                           -                     -> WorkflowSettings     (200)
//
// The metadata reads are **records only, never bytes**. A workflow pod holds its
// own object-storage credentials and fetches every file itself, so each file
// reference carries the recorded `storageKey` and the response carries no
// payload and no download URL. The `Workflow*` shapes are deliberately narrower
// than the ones the SPA reads: they carry what a workflow actually branches on
// and drop the presentation fields — download URLs, contributor lists, linked
// samples — that would otherwise have to be kept parseable here forever.
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
import { AnalysisFormat, AnalysisWorkflow } from "./analyses";
import { JobClaim, JobState, JobStep, JobTimestamp, JobWorkflow } from "./jobs";
import { JsonObject } from "./json";
import { LibraryType, Quality } from "./samples";
import { NucleotideComposition } from "./subtractions";
import { UserNested } from "./users";

/** A workflow step as the runner declares it at claim time. The runner owns its own step list. */
export const JobStepDefinition = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

export type JobStepDefinition = z.infer<typeof JobStepDefinition>;

/** Response to `POST /jobs/{jobId}/steps/{stepId}/start` — the step, now started. */
export const JobStepStarted = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	startedAt: JobTimestamp,
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
	claimedAt: JobTimestamp,
	createdAt: JobTimestamp,

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

/**
 * Response to `PUT /jobs/{jobId}/ping`.
 *
 * Carries no cancellation flag, matching Python's model. **A refusal is the
 * cancellation channel**: reaching a terminal state is what stops a job key
 * authenticating, so a cancelled job's next ping is answered `401` rather than
 * `200` with a flag set. A flag would have to be readable by a credential the
 * same transition revokes, and it would speak only for `cancelled` — a job
 * swept up by the ping timeout is `failed`, and the runner has to stop for that
 * too. See the ping loop in `@virtool/workflow`.
 */
export const JobPing = z.object({
	pingedAt: JobTimestamp,
});

export type JobPing = z.infer<typeof JobPing>;

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
//
// Where a resource is unusable without its files, the manifest is required to
// carry them: an empty array would flip the parent `ready` over nothing, which
// is the state a single finalize call exists to prevent.

/**
 * Body for `PATCH /samples/{id}` — the sample finalize call.
 *
 * A `create_sample` run writes `reads_1.fq.gz` and, for a paired library,
 * `reads_2.fq.gz`. Neither zero reads nor three is ever a valid outcome, so the
 * bound is on the contract rather than left to the route.
 */
export const FinalizeSampleRequest = z.object({
	quality: Quality,
	files: z.array(SampleReadManifest).min(1).max(2),
});

export type FinalizeSampleRequest = z.infer<typeof FinalizeSampleRequest>;

/**
 * Body for `PATCH /subtractions/{id}` — the subtraction finalize call.
 *
 * The route's whitelist accepts one filename, `subtraction.fa.gz`, and rejects
 * a duplicate, so requiring a non-empty manifest here makes the source genome
 * exactly-once without a second check.
 */
export const FinalizeSubtractionRequest = z.object({
	count: z.number().int().nonnegative(),
	gc: NucleotideComposition,
	files: z.array(SubtractionFileManifest).min(1),
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

	/**
	 * Empty is legitimate here, unlike the other two. Pathoscope's entire output
	 * is `results` and it retains no files; NuVs is the workflow that writes
	 * FASTA and HMM outputs. `results` is the guard on an analysis being usable.
	 */
	files: z.array(AnalysisFileManifest),
});

export type FinalizeAnalysisRequest = z.infer<typeof FinalizeAnalysisRequest>;

/**
 * A file reference on a metadata read, as a workflow receives it.
 *
 * **`storageKey` is what makes the reference usable at all.** Nothing composes
 * a key from row identity on either side — a migrated object keeps whatever
 * prefix it was written under, so no pattern reconstructs one — and a workflow
 * that receives a reference without a key can see that the file exists and
 * reach none of it.
 *
 * The key is nullable wherever its column is, which is every file table but
 * `index_files`. A workflow handed a null must fail rather than guess: there is
 * no fallback that finds the object.
 *
 * This is the read direction only. A manifest a workflow *sends* never carries
 * a key it chose — see {@link JobFileManifest}, where the asymmetry is the
 * point.
 */
const workflowFile = {
	id: z.number().int(),
	name: z.string(),
	size: z.number().int().nullable(),
};

/** A reads file a workflow downloads to run against. */
export const WorkflowSampleRead = z.object({
	...workflowFile,
	storageKey: z.string().nullable(),
});

export type WorkflowSampleRead = z.infer<typeof WorkflowSampleRead>;

/**
 * One of the uploads a sample was created from — the raw reads
 * `create_sample` normalizes.
 *
 * It rides on the sample for the same reason {@link WorkflowSubtractionUpload}
 * rides on the subtraction: `create_sample` is the only reader, its job args
 * carry `sample_id` and nothing else, and an uploads route of its own would be
 * a second round trip for two columns.
 *
 * The order is `sample_uploads.index` — the position the upload held in the
 * create request — which is what decides whether it becomes `reads_1.fq.gz` or
 * `reads_2.fq.gz`. Nothing else links the two, so a run must not reorder them.
 *
 * Every field but the id is nullable because every column behind it is:
 * `uploads.name`, `uploads.size` and `uploads.storage_key` are all open. A
 * workflow refuses a null name or key rather than guessing — nothing composes a
 * key from row identity on either side.
 */
export const WorkflowSampleUpload = z.object({
	id: z.number().int(),
	name: z.string().nullable(),
	size: z.number().int().nullable(),
	storageKey: z.string().nullable(),
});

export type WorkflowSampleUpload = z.infer<typeof WorkflowSampleUpload>;

/** A subtraction's source genome or one shard of its built index. */
export const WorkflowSubtractionFile = z.object({
	...workflowFile,
	storageKey: z.string().nullable(),
	type: z.string(),
});

export type WorkflowSubtractionFile = z.infer<typeof WorkflowSubtractionFile>;

/**
 * The upload a subtraction was created from — its source genome.
 *
 * It rides on the subtraction rather than being fetched from an uploads route of
 * its own. `create_subtraction` is the only reader, it has the subtraction id and
 * nothing else, and an upload read would be a second round trip for one column.
 *
 * Every field but the id is nullable because every column behind it is:
 * `subtractions.upload_id`, `uploads.name` and `uploads.storage_key` are all
 * open, so a subtraction can name an upload whose bytes nothing locates. The
 * workflow refuses that rather than guessing — nothing composes a key from row
 * identity on either side.
 */
export const WorkflowSubtractionUpload = z.object({
	id: z.number().int(),
	name: z.string().nullable(),
	size: z.number().int().nullable(),
	storageKey: z.string().nullable(),
});

export type WorkflowSubtractionUpload = z.infer<
	typeof WorkflowSubtractionUpload
>;

/** A file an index build produced. `index_files.storage_key` is `NOT NULL`. */
export const WorkflowIndexFile = z.object({
	...workflowFile,
	storageKey: z.string(),
	type: z.string(),
});

export type WorkflowIndexFile = z.infer<typeof WorkflowIndexFile>;

/**
 * A sample, as a workflow reads it.
 *
 * `paired` is derived from the reads rather than stored, and is what a workflow
 * branches on to decide whether it is running one file or two.
 *
 * `reads` is what an analysis workflow reads and is empty until finalize;
 * `uploads` is what `create_sample` reads and is the only thing on a sample
 * that has not been built yet.
 */
export const WorkflowSample = z.object({
	id: z.number().int(),
	libraryType: LibraryType,
	name: z.string(),
	paired: z.boolean(),
	quality: Quality.nullable(),
	reads: z.array(WorkflowSampleRead),
	uploads: z.array(WorkflowSampleUpload),
});

export type WorkflowSample = z.infer<typeof WorkflowSample>;

/**
 * A subtraction, as a workflow reads it.
 *
 * `files` is what an analysis workflow reads and is empty until finalize;
 * `upload` is what `create_subtraction` reads and is the only thing on a
 * subtraction that has not been built yet.
 */
export const WorkflowSubtraction = z.object({
	id: z.number().int(),
	count: z.number().int().nullable(),
	files: z.array(WorkflowSubtractionFile),
	gc: NucleotideComposition.nullable(),
	name: z.string(),
	nickname: z.string(),
	ready: z.boolean(),
	upload: WorkflowSubtractionUpload.nullable(),
});

export type WorkflowSubtraction = z.infer<typeof WorkflowSubtraction>;

/**
 * An index build, as a workflow reads it.
 *
 * `manifest` is the OTU-id to version map the build is pinned to, straight out
 * of a JSONB column. Its keys are legacy Mongo OTU ids, so it is a record of
 * strings rather than anything this side interprets.
 */
export const WorkflowIndex = z.object({
	id: z.number().int(),
	files: z.array(WorkflowIndexFile),
	manifest: z.record(z.string(), z.number().int()),
	ready: z.boolean(),
	reference: z.object({ id: z.number().int(), name: z.string() }),
	version: z.number().int(),
});

export type WorkflowIndex = z.infer<typeof WorkflowIndex>;

/**
 * An analysis, as a workflow reads it.
 *
 * **`sample` is an object carrying an id, not a bare id.** Python's workflow
 * runtime falls back to reading it when a job's `args` carry no `sample_id`, so
 * flattening it breaks every analysis whose job was created without one.
 *
 * No results and no files: an analysis a workflow is running has neither yet,
 * and reading them would pull in the formatting layer this read exists to avoid.
 */
export const WorkflowAnalysis = z.object({
	id: z.number().int(),
	index: z.object({ id: z.number().int(), version: z.number().int() }),
	ready: z.boolean(),
	reference: z.object({ id: z.number().int(), name: z.string() }),
	sample: z.object({ id: z.number().int(), name: z.string() }),
	subtractions: z.array(z.object({ id: z.number().int(), name: z.string() })),
	workflow: AnalysisWorkflow,
});

export type WorkflowAnalysis = z.infer<typeof WorkflowAnalysis>;

/**
 * A reference, as a workflow reads it.
 *
 * Metadata only. The rights lists, contributors and build history the SPA shows
 * are about who may edit a reference, which is not a question a workflow asks.
 */
export const WorkflowReference = z.object({
	id: z.number().int(),
	dataType: z.string(),
	description: z.string(),
	name: z.string(),
	organism: z.string(),
});

export type WorkflowReference = z.infer<typeof WorkflowReference>;

/** The instance settings singleton, as a workflow reads it. */
export const WorkflowSettings = z.object({
	defaultSourceTypes: z.array(z.string()),
	enableSentry: z.boolean(),
	minimumPasswordLength: z.number().int(),
	sampleAllRead: z.boolean(),
	sampleAllWrite: z.boolean(),
	sampleGroup: z.enum(["none", "force_choice", "users_primary_group"]),
	sampleGroupRead: z.boolean(),
	sampleGroupWrite: z.boolean(),
});

export type WorkflowSettings = z.infer<typeof WorkflowSettings>;
