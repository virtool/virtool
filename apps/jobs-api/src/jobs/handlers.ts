import {
	ClaimableJobWorkflow,
	CreateJobClaimRequest,
	fromStoredJobClaim,
	fromStoredJobStep,
	type JobClaimed,
	type JobPing,
	type JobStepStarted,
	toStoredJobClaim,
	WorkflowJob,
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
import { jsonError, parseJsonBody, requireRowId } from "../http";

/** What the job lifecycle handlers need to serve a request. */
export type JobHandlerDeps = {
	db: Db;
	logger: Logger;
};

/**
 * Map a job row onto the wire, refusing to serve one that does not fit.
 *
 * A timestamp crosses as a `Date` and is encoded by `Response.json`, so nothing
 * here calls `toISOString`. A column that already holds a `timestamp` is passed
 * straight through; the one that holds an ISO string — `steps[].started_at`,
 * which Python writes — is converted by `fromStoredJobStep`.
 *
 * `jobs.workflow` is a `text` column carrying no CHECK constraint, so the data
 * layer types it as a plain string while the wire types it as a union. The
 * response is **parsed** rather than asserted into shape, because a row naming a
 * workflow this build has never heard of cannot be served as itself either way:
 * the runtime's client parses what it receives with this same schema, so an
 * unknown value is a `JobsApiError` at a runner that can do nothing about it.
 * Parsing here puts the failure on the side that owns the data.
 *
 * A failure is **thrown**, not returned. `jsonError` is the shape a deliberate
 * refusal takes, and this is a bug in the data: `app.onError` is the one place
 * that logs it against a bounded route label, reports it to Sentry and answers
 * `500`, so the message names the job the row belongs to.
 *
 * Only the two job shapes are parsed on the way out. A blanket
 * response-validation layer would tax every response in the service for a
 * looseness that exists on this one column.
 */
function toJob(record: JobRecord): WorkflowJob {
	const parsed = WorkflowJob.safeParse({
		id: record.id,
		args: record.args,
		claim: record.claim ? fromStoredJobClaim(record.claim) : null,
		claimedAt: record.claimedAt,
		createdAt: record.createdAt,
		pingedAt: record.pingedAt,
		progress: record.progress,
		state: record.state,
		steps: record.steps?.map(fromStoredJobStep) ?? null,
		user: record.user,
		workflow: record.workflow,
	});

	if (!parsed.success) {
		// The field paths, never the values: a message is a Sentry title, and row
		// content does not belong in one.
		throw new Error(
			`job ${record.id} does not fit the wire contract: ${parsed.error.issues
				.map((issue) => issue.path.join("."))
				.join(", ")}`,
		);
	}

	return parsed.data;
}

// `workflow` is the claim's own parsed query parameter rather than the claimed
// row's `string`, so nothing here re-narrows a value the handler already holds
// correctly typed. Every other field is either a literal or already narrow, so
// this shape needs no parse of its own.
function toJobClaimed(
	claimed: ClaimedJob,
	workflow: ClaimableJobWorkflow,
): JobClaimed {
	return {
		id: claimed.id,
		acquired: true,
		claim: fromStoredJobClaim(claimed.claim),
		claimedAt: claimed.claimedAt,
		createdAt: claimed.createdAt,
		key: claimed.key,
		state: "running",
		steps: claimed.steps.map(fromStoredJobStep),
		user: claimed.user,
		workflow,
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

	const jobId = requireRowId(jobIdParam, "Job not found");

	if (jobId instanceof Response) {
		return jobId;
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

	const parsed = await parseJsonBody(request, CreateJobClaimRequest);

	if (parsed instanceof Response) {
		return parsed;
	}

	const { steps, ...claim } = parsed;

	try {
		const claimed = await claimJob(deps.db, workflow.data, {
			claim: toStoredJobClaim(claim),
			steps,
		});

		deps.logger.info(
			{ jobId: claimed.id, runnerId: claim.runnerId, workflow: workflow.data },
			"claimed a job",
		);

		return Response.json(toJobClaimed(claimed, workflow.data));
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
