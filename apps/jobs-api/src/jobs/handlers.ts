import {
	ClaimableJobWorkflow,
	CreateJobClaimRequest,
	fromStoredJobClaim,
	fromStoredJobStep,
	type Job,
	type JobClaimed,
	type JobPing,
	type JobState,
	type JobStepStarted,
	type JobWorkflow,
	toStoredJobClaim,
} from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import {
	type ClaimedJob,
	claimJob,
	finishJob,
	getJob,
	JobNotFoundError,
	JobNotRunningError,
	type Job as JobRecord,
	JobStepAlreadyStartedError,
	JobStepNotFoundError,
	JobTerminalStateError,
	NoJobAvailableError,
	pingJob,
	type StartedJobStep,
	startJobStep,
} from "@virtool/data/jobs/data";
import type { Logger } from "@virtool/logger";
import { requireJobRequest } from "../auth/guard";
import type { JobPrincipal } from "../auth/verify";
import { jsonError, parseRowId } from "../http";

/** What the job lifecycle handlers need to serve a request. */
export type JobHandlerDeps = {
	db: Db;
	logger: Logger;
};

// A timestamp crosses as a `Date` and is encoded by `Response.json`, so nothing
// here calls `toISOString`. A column that already holds a `timestamp` is passed
// straight through; the one that holds an ISO string — `steps[].started_at`,
// which Python writes — is converted by `fromStoredJobStep`.
//
// `jobs.state` and `jobs.workflow` are `text` columns, so the data layer types
// them as plain strings and the wire types them as unions. Narrowing here rather
// than parsing the whole response keeps a row Python wrote under a state or
// workflow this build has never heard of serving as itself, instead of failing
// the read with a 500 the runner can do nothing about.
function toJob(record: JobRecord): Job {
	return {
		id: record.id,
		args: record.args,
		claim: record.claim ? fromStoredJobClaim(record.claim) : null,
		claimedAt: record.claimed_at,
		createdAt: record.created_at,
		pingedAt: record.pinged_at,
		progress: record.progress,
		state: record.state as JobState,
		steps: record.steps?.map(fromStoredJobStep) ?? null,
		user: record.user,
		workflow: record.workflow as JobWorkflow,
	};
}

function toJobClaimed(claimed: ClaimedJob): JobClaimed {
	return {
		id: claimed.id,
		acquired: true,
		claim: fromStoredJobClaim(claimed.claim),
		claimedAt: claimed.claimed_at,
		createdAt: claimed.created_at,
		key: claimed.key,
		state: "running",
		steps: claimed.steps.map(fromStoredJobStep),
		user: claimed.user,
		workflow: claimed.workflow as JobWorkflow,
	};
}

function toJobStepStarted(step: StartedJobStep): JobStepStarted {
	return {
		id: step.id,
		name: step.name,
		description: step.description,
		startedAt: new Date(step.started_at),
	};
}

/**
 * Resolve the job a request is authenticated as, and require it to be the job
 * the path names.
 *
 * Python enforces this in its auth middleware, comparing the credential's job
 * id against a `job_id` match-info parameter for every route that has one. It
 * belongs here instead: it is a rule about a route's path, not a property of the
 * credential, which is why `JobPrincipal` carries the id rather than the guard
 * carrying the comparison.
 *
 * A mismatch is **403, not 404**. The caller authenticated successfully and is
 * asking about a job that is simply not its own; hiding the job's existence
 * would be pointless, because a runner holding a valid key already knows job ids
 * are consecutive integers.
 */
async function requireOwnJob(
	deps: JobHandlerDeps,
	request: Request,
	jobIdParam: string,
): Promise<JobPrincipal | Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const jobId = parseRowId(jobIdParam);

	if (jobId === null) {
		return jsonError(404, "Job not found");
	}

	if (jobId !== principal.jobId) {
		return jsonError(403, "Job key does not match the requested job");
	}

	return principal;
}

/**
 * Hand the oldest waiting job for a workflow to the runner asking for it.
 *
 * **Unauthenticated, and it has to be**: the key a runner authenticates every
 * later request with is minted here and returned in this response, so there is
 * nothing to present yet. A KEDA `ScaledJob` starts a pod with neither a job id
 * nor a key, and this call is where it learns both.
 *
 * 404 when nothing is waiting. That is the ordinary case — runners poll — so it
 * carries no body worth reading and the client treats it as "try again".
 */
export async function handleClaimJob(
	deps: JobHandlerDeps,
	request: Request,
): Promise<Response> {
	// A query parameter rather than a body field, matching Python's
	// `ClaimJobView`.
	const requested = new URL(request.url).searchParams.get("workflow");

	const workflow = ClaimableJobWorkflow.safeParse(requested);

	if (!workflow.success) {
		return jsonError(422, "Unknown or unclaimable workflow");
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonError(400, "Malformed body");
	}

	const parsed = CreateJobClaimRequest.safeParse(body);

	if (!parsed.success) {
		return Response.json(
			{ message: "Invalid body", errors: parsed.error.issues },
			{ status: 400 },
		);
	}

	const { steps, ...claim } = parsed.data;

	try {
		const claimed = await claimJob(deps.db, workflow.data, {
			claim: toStoredJobClaim(claim),
			steps,
		});

		deps.logger.info(
			{ jobId: claimed.id, runnerId: claim.runnerId, workflow: workflow.data },
			"claimed a job",
		);

		return Response.json(toJobClaimed(claimed));
	} catch (err) {
		if (err instanceof NoJobAvailableError) {
			return jsonError(404, "No job available");
		}

		throw err;
	}
}

/**
 * Read the job a runner is working on.
 *
 * This is where a run gets its `args`: the claim response deliberately carries
 * none, matching Python, so a runner reads them back once after claiming.
 */
export async function handleReadJob(
	deps: JobHandlerDeps,
	request: Request,
	jobIdParam: string,
): Promise<Response> {
	const principal = await requireOwnJob(deps, request, jobIdParam);

	if (principal instanceof Response) {
		return principal;
	}

	try {
		return Response.json(toJob(await getJob(deps.db, principal.jobId)));
	} catch (err) {
		if (err instanceof JobNotFoundError) {
			return jsonError(404, "Job not found");
		}

		throw err;
	}
}

/**
 * Record a heartbeat.
 *
 * A job that has finished never reaches this handler — its key stops
 * authenticating the moment it reaches a terminal state, so the guard refuses it
 * first. That refusal is the cancellation channel, and the whole of it.
 */
export async function handlePingJob(
	deps: JobHandlerDeps,
	request: Request,
	jobIdParam: string,
): Promise<Response> {
	const principal = await requireOwnJob(deps, request, jobIdParam);

	if (principal instanceof Response) {
		return principal;
	}

	try {
		const body: JobPing = { pingedAt: await pingJob(deps.db, principal.jobId) };

		return Response.json(body);
	} catch (err) {
		if (err instanceof JobNotFoundError) {
			return jsonError(404, "Job not found");
		}

		throw err;
	}
}

/**
 * Stamp a start time on one of a job's steps.
 *
 * Starting a step twice is a conflict rather than a no-op: progress is derived
 * from how many steps have started, so a silent restamp would move a job's
 * progress without moving its work.
 *
 * The terminal-state conflict below looks unreachable — the guard refuses a
 * finished job's key before a handler runs — and is reachable only as a race,
 * where the job is cancelled between the guard's read and the transaction
 * taking its lock. That is the reason the check lives in the data layer rather
 * than being inferred from the guard having let the request through.
 */
export async function handleStartJobStep(
	deps: JobHandlerDeps,
	request: Request,
	jobIdParam: string,
	stepId: string,
): Promise<Response> {
	const principal = await requireOwnJob(deps, request, jobIdParam);

	if (principal instanceof Response) {
		return principal;
	}

	try {
		const step = await startJobStep(deps.db, principal.jobId, stepId);

		return Response.json(toJobStepStarted(step));
	} catch (err) {
		if (err instanceof JobNotFoundError) {
			return jsonError(404, "Job not found");
		}

		if (err instanceof JobStepNotFoundError) {
			return jsonError(404, "Step not found");
		}

		if (err instanceof JobTerminalStateError) {
			return jsonError(409, "Job is in a terminal state");
		}

		if (err instanceof JobStepAlreadyStartedError) {
			return jsonError(409, "Step already started");
		}

		throw err;
	}
}

/**
 * Mark a job succeeded.
 *
 * The only terminal transition a runner makes. There is deliberately no failure
 * counterpart — a job fails by being cancelled or by the stalled-job sweep — so
 * a workflow that fails simply stops calling.
 */
export async function handleFinishJob(
	deps: JobHandlerDeps,
	request: Request,
	jobIdParam: string,
): Promise<Response> {
	const principal = await requireOwnJob(deps, request, jobIdParam);

	if (principal instanceof Response) {
		return principal;
	}

	try {
		const job = await finishJob(deps.db, principal.jobId);

		deps.logger.info({ jobId: principal.jobId }, "finished job");

		return Response.json(toJob(job));
	} catch (err) {
		if (err instanceof JobNotFoundError) {
			return jsonError(404, "Job not found");
		}

		if (err instanceof JobNotRunningError) {
			return jsonError(409, "Job is not running");
		}

		throw err;
	}
}
