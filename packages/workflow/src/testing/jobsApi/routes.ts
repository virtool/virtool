/**
 * The jobs API's behaviour, over {@link JobsApiState}.
 *
 * Ported from `tests/fixtures/workflow_api/`, which spread the same route table
 * across seven aiohttp modules. There is **one** implementation here and both
 * halves of the harness call it — the faked client and the embedded server —
 * because two implementations of the same fixture drift, and the half a test is
 * not using is the half that stops matching the real service.
 *
 * **Every field is camelCase**, taken from the schemas in `@virtool/contracts`
 * rather than transcribed from Python's `started_at` / `pinged_at`. The embedded
 * server is the fixture the jobs API client is tested against: spelled
 * snake_case on both sides they would agree with each other and the mismatch
 * would surface only against the real `apps/jobs-api`.
 */

import {
	type Cache,
	type CacheRegistered,
	ClaimableJobWorkflow,
	CreateJobClaimRequest,
	FinalizeAnalysisRequest,
	FinalizeSampleRequest,
	FinalizeSubtractionRequest,
	isJobStateTerminal,
	type Job,
	type JobClaimed,
	type JobPing,
	type JobStepStarted,
	RegisterCacheRequest,
	type WorkflowSample,
} from "@virtool/contracts";
import { cacheKey } from "@virtool/storage";
import type { JobsApiState } from "./state";

/** One request against the fixture, transport-agnostic. */
export type JobsApiRequest = {
	method: string;
	/** Unprefixed, matching the jobs API's paths byte for byte. */
	path: string;
	/**
	 * The query string, which only `POST /jobs/claim` reads.
	 *
	 * Separate from `path` because the embedded server has it parsed already and
	 * because the claim's `workflow` is the one thing this fixture routes on that
	 * is not a segment.
	 */
	searchParams?: URLSearchParams;
	/** The parsed request body, or undefined when there was none. */
	body?: unknown;
};

/**
 * One response.
 *
 * `body` is pre-serialization — `Date`s are still `Date`s — because both callers
 * put it through `JSON.stringify` and the client parses the result with the same
 * schema the real service's response is parsed with.
 */
export type JobsApiResponse = {
	status: number;
	body: unknown;
};

function notFound(message = "Not found"): JobsApiResponse {
	return { status: 404, body: { message } };
}

function conflict(message: string): JobsApiResponse {
	return { status: 409, body: { message } };
}

/**
 * The states a job never leaves, and what a runner holding a key for one is
 * told.
 *
 * A copy of `TERMINAL_REFUSALS` in `apps/jobs-api/src/auth/verify.ts`, wording
 * and all. The message is the whole of the cancellation channel, so a fixture
 * that answered `Job is failed.` where the service answers `Job has failed.`
 * would let a run that keyed on the wording pass here and stall in production.
 */
const TERMINAL_REFUSALS: Record<string, string> = {
	cancelled: "Job is cancelled.",
	failed: "Job has failed.",
	succeeded: "Job has succeeded.",
};

/**
 * Split a path into its segments.
 *
 * A leading, trailing or doubled slash produces empty segments, which are
 * dropped so `/jobs/1/ping` and `/jobs/1/ping/` route the same way.
 */
function segments(path: string): string[] {
	return path.split("/").filter(Boolean);
}

function parseId(segment: string | undefined): number | null {
	if (segment === undefined || !/^\d+$/.test(segment)) {
		return null;
	}

	return Number(segment);
}

/**
 * The job as `GET /jobs/{jobId}` and `POST /jobs/{jobId}/finish` return it.
 *
 * A copy, so a caller mutating what it read cannot reach back into the fixture.
 */
function readJob(state: JobsApiState): Job {
	return {
		...state.job,
		steps: state.job.steps?.map((step) => ({ ...step })) ?? null,
	};
}

/**
 * Hand out the one job this fixture holds.
 *
 * The workflow arrives as a query parameter rather than a body field, matching
 * Python's `ClaimJobView` and `handleClaimJob`, and it is **checked against the
 * job's own workflow**. A fixture that handed its `create_subtraction` job to a
 * runner asking for `nuvs` would let a test pass with a claim configuration the
 * real service answers 404 to, which is the runner polling forever.
 */
function handleClaim(
	state: JobsApiState,
	requested: string | null,
	body: unknown,
): JobsApiResponse {
	// `build_index` parses as a job workflow and is refused here: nothing creates
	// one any more, so handing one out would start a pod nothing finishes.
	const workflow = ClaimableJobWorkflow.safeParse(requested);

	if (!workflow.success) {
		return {
			status: 422,
			body: { message: "Unknown or unclaimable workflow" },
		};
	}

	const parsed = CreateJobClaimRequest.safeParse(body);

	if (!parsed.success) {
		return { status: 400, body: { message: parsed.error.message } };
	}

	// Python's fixture answers a second claim with a 404, the same status it uses
	// for "no job available" — a runner cannot tell the two apart and does not
	// need to. Asking for a workflow this fixture's job does not run is the same
	// answer for the same reason.
	if (state.acquired || workflow.data !== state.job.workflow) {
		return notFound("No job available");
	}

	const { steps, ...claim } = parsed.data;

	state.acquired = true;
	state.job.state = "running";
	state.job.claim = claim;
	state.job.claimedAt = state.now();

	// The runner owns its own step list, so the fixture takes the posted steps
	// rather than keeping whatever the job was seeded with. `startedAt` is null
	// on every one of them: starting a step is its own call.
	state.job.steps = steps.map((step) => ({ ...step, startedAt: null }));

	const claimed: JobClaimed = {
		id: state.job.id,
		acquired: true,
		claim,
		claimedAt: state.now(),
		createdAt: state.job.createdAt,
		key: state.key,
		state: "running",
		steps: state.job.steps,
		user: state.job.user,
		workflow: state.job.workflow,
	};

	return { status: 200, body: claimed };
}

/**
 * Heartbeat.
 *
 * A terminal job never reaches here: its key stops authenticating first, and
 * that refusal is the cancellation channel. See {@link TERMINAL_REFUSALS} and
 * the check at the top of {@link handleJobsApiRequest}.
 */
function handlePing(state: JobsApiState): JobsApiResponse {
	const pingedAt = state.now();

	state.pingedAt = pingedAt;

	const ping: JobPing = { pingedAt };

	return { status: 200, body: ping };
}

/**
 * Stamp a start time on one of the job's steps.
 *
 * Starting a step twice is a **conflict**, not a no-op, matching
 * `handleStartJobStep`: progress is derived from how many steps have started, so
 * a silent restamp would move a job's progress without moving its work.
 */
function handleStartStep(state: JobsApiState, stepId: string): JobsApiResponse {
	const step = state.job.steps?.find((candidate) => candidate.id === stepId);

	if (!step) {
		return notFound(`No step ${stepId}`);
	}

	if (step.startedAt !== null) {
		return conflict("Step already started");
	}

	step.startedAt = state.now();
	state.stepStartUpdates.push(stepId);

	const started: JobStepStarted = {
		id: step.id,
		name: step.name,
		description: step.description,
		startedAt: step.startedAt,
	};

	return { status: 200, body: started };
}

/**
 * Mark the job succeeded.
 *
 * The conflict below is unreachable through a credential — finishing revokes the
 * key, so a second finish is refused as a 401 before it arrives here — and is
 * kept because production keeps it, where it is reachable as a race between the
 * guard's read and the transaction's lock.
 */
function handleFinish(state: JobsApiState): JobsApiResponse {
	if (isJobStateTerminal(state.job.state)) {
		return conflict(`Job is already ${state.job.state}.`);
	}

	state.job.state = "succeeded";
	state.job.progress = 100;
	state.finishCalled = true;

	return { status: 200, body: readJob(state) };
}

function handleRegisterCache(
	state: JobsApiState,
	body: unknown,
): JobsApiResponse {
	const parsed = RegisterCacheRequest.safeParse(body);

	if (!parsed.success) {
		return { status: 400, body: { message: parsed.error.message } };
	}

	state.cacheRegistrations.push(parsed.data);

	const existing = state.caches.get(parsed.data.key);

	// Two workflows can legitimately derive the same key at once and both blobs
	// hold the same bytes, so "already existed" is success and the loser is
	// handed the winner's row.
	if (existing) {
		const registered: CacheRegistered = { ...existing, created: false };

		return { status: 200, body: registered };
	}

	const cache: Cache = {
		id: state.caches.size + 1,
		key: parsed.data.key,
		// Composed server-side from the uuid, never taken from the caller. A
		// caller-supplied key would let a job register a row pointing at another
		// domain's object, which Python's LRU eviction would then delete.
		storageKey: cacheKey(parsed.data.uuid),
		size: 0,
		params: parsed.data.params,
		createdAt: state.now().toISOString(),
		lastAccessedAt: state.now().toISOString(),
	};

	state.caches.set(cache.key, cache);

	const registered: CacheRegistered = { ...cache, created: true };

	return { status: 201, body: registered };
}

function handleFinalize(
	state: JobsApiState,
	resource: string,
	id: number,
	body: unknown,
): JobsApiResponse {
	if (resource === "samples") {
		const sample = state.samples.get(id);

		if (!sample) {
			return notFound(`No sample ${id}`);
		}

		const parsed = FinalizeSampleRequest.safeParse(body);

		if (!parsed.success) {
			return { status: 400, body: { message: parsed.error.message } };
		}

		state.finalizeCalls.push({ resource: "sample", id, request: parsed.data });

		const updated: WorkflowSample = {
			...sample,
			quality: parsed.data.quality,
			// The route records each manifest entry as a `sample_reads` row, so the
			// next `GET /samples/{id}` serves the keys the workflow just declared.
			// Leaving the row's `reads` alone would make the fixture's read path
			// unreachable from its own write path. Size is read back from storage by
			// the real route; zero stands in for a fixture that wrote no bytes.
			reads: parsed.data.files.map((file, index) => ({
				id: index + 1,
				name: file.name,
				size: 0,
				storageKey: file.storageKey,
			})),
			// Derived from the reads rather than stored, the same way `getSample`
			// derives it.
			paired: parsed.data.files.length === 2,
		};

		state.samples.set(id, updated);

		return { status: 200, body: updated };
	}

	if (resource === "subtractions") {
		const subtraction = state.subtractions.get(id);

		if (!subtraction) {
			return notFound(`No subtraction ${id}`);
		}

		const parsed = FinalizeSubtractionRequest.safeParse(body);

		if (!parsed.success) {
			return { status: 400, body: { message: parsed.error.message } };
		}

		state.finalizeCalls.push({
			resource: "subtraction",
			id,
			request: parsed.data,
		});

		const updated = {
			...subtraction,
			count: parsed.data.count,
			gc: parsed.data.gc,
			ready: true,
			// The route reads each file's size back from storage; the manifest
			// declares none. Zero stands in for a fixture that wrote no bytes.
			files: parsed.data.files.map((file, index) => ({
				id: index + 1,
				name: file.name,
				size: 0,
				storageKey: file.storageKey,
				type: file.name.endsWith(".fa.gz") ? "fasta" : "bowtie2",
			})),
		};

		state.subtractions.set(id, updated);

		return { status: 200, body: updated };
	}

	const analysis = state.analyses.get(id);

	if (!analysis) {
		return notFound(`No analysis ${id}`);
	}

	const parsed = FinalizeAnalysisRequest.safeParse(body);

	if (!parsed.success) {
		return { status: 400, body: { message: parsed.error.message } };
	}

	state.finalizeCalls.push({ resource: "analysis", id, request: parsed.data });

	const updated = { ...analysis, ready: true };

	state.analyses.set(id, updated);

	return { status: 200, body: updated };
}

const FINALIZABLE = new Set(["samples", "subtractions", "analyses"]);

/**
 * Answer one request against the fixture.
 *
 * @returns the status and the body, before serialization. Nothing throws: every
 *   outcome the jobs API has is a status, and mapping it to an error is the
 *   client's job on both halves.
 */
export function handleJobsApiRequest(
	state: JobsApiState,
	{ method, path, searchParams, body }: JobsApiRequest,
): JobsApiResponse {
	const parts = segments(path);
	const [head, second, third, fourth, fifth] = parts;

	if (method === "POST" && head === "jobs" && second === "claim") {
		return handleClaim(state, searchParams?.get("workflow") ?? null, body);
	}

	// **A terminal job's key stops authenticating, on every route.** The real
	// service refuses it in `requireJobRequest`, which is the floor under every
	// handler — not in the ping handler, which is only where a run notices. A
	// fixture that checked it on the ping alone would serve reads, step starts
	// and finalize calls to a cancelled job that production refuses.
	//
	// It sits behind the server's key comparison and after the claim, which is
	// what makes naming the state safe: only a caller already holding this job's
	// key reaches it, and the claim is where the key is minted.
	const refusal = TERMINAL_REFUSALS[state.job.state];

	if (refusal) {
		return { status: 401, body: { message: refusal } };
	}

	if (head === "settings" && parts.length === 1 && method === "GET") {
		return { status: 200, body: state.settings };
	}

	if (head === "caches") {
		if (method === "POST" && parts.length === 1) {
			return handleRegisterCache(state, body);
		}

		if (method === "GET" && second !== undefined) {
			// The logical cache key can itself carry slashes, so it is everything
			// after the prefix rather than one segment.
			const key = parts.slice(1).join("/");
			const cache = state.caches.get(key);

			return cache ? { status: 200, body: cache } : notFound(`No cache ${key}`);
		}
	}

	if (head === "jobs") {
		const jobId = parseId(second);

		if (jobId === null) {
			return notFound();
		}

		// A route carrying a job id checks it against the authenticated job. The
		// real service answers 403 rather than 404, so a runner cannot probe for
		// the existence of another job.
		if (jobId !== state.job.id) {
			return { status: 403, body: { message: "Forbidden" } };
		}

		if (method === "GET" && parts.length === 2) {
			return { status: 200, body: readJob(state) };
		}

		if (method === "PUT" && third === "ping") {
			return handlePing(state);
		}

		if (method === "POST" && third === "finish") {
			return handleFinish(state);
		}

		if (
			method === "POST" &&
			third === "steps" &&
			fourth !== undefined &&
			fifth === "start"
		) {
			return handleStartStep(state, fourth);
		}
	}

	const resourceId = parseId(second);

	if (resourceId !== null && parts.length === 2) {
		if (method === "PATCH" && head !== undefined && FINALIZABLE.has(head)) {
			return handleFinalize(state, head, resourceId, body);
		}

		if (method === "GET") {
			const found = {
				analyses: state.analyses,
				indexes: state.indexes,
				samples: state.samples,
				subtractions: state.subtractions,
			}[head ?? ""]?.get(resourceId);

			return found
				? { status: 200, body: found }
				: notFound(`No ${head} ${resourceId}`);
		}
	}

	return notFound(`No route for ${method} ${path}`);
}
