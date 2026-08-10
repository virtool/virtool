import { JobPing, type JsonValue, WorkflowJob } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { Agent, fetch } from "undici";
import type { ZodType } from "zod";
import { assertOkResponse, JobsApiError, TransportError } from "./errors";
import { withRetry } from "./retry";

/**
 * The overall budget for one request, in milliseconds. Python's
 * `ClientTimeout(total=600)`.
 */
export const REQUEST_BUDGET_MS = 600_000;

/**
 * Socket-level deadlines, in milliseconds, matching aiohttp's `sock_connect`
 * and `sock_read`.
 *
 * The overall budget alone is not equivalent: it does not bound a stalled
 * socket that keeps trickling bytes, which is the failure the ping loop's
 * give-up window has to stay ahead of.
 */
export const CONNECT_TIMEOUT_MS = 30_000;
export const HEADERS_TIMEOUT_MS = 60_000;
export const BODY_TIMEOUT_MS = 60_000;

/** The dispatcher every request in a run shares. One per client. */
export function createDispatcher(): Agent {
	return new Agent({
		connectTimeout: CONNECT_TIMEOUT_MS,
		headersTimeout: HEADERS_TIMEOUT_MS,
		bodyTimeout: BODY_TIMEOUT_MS,
	});
}

/**
 * Append a path to the jobs API's base URL.
 *
 * Plain concatenation, matching Python's `f"{connection_string}{path}"`, so a
 * base URL carrying a path prefix keeps it. `new URL(path, base)` would discard
 * one.
 */
export function joinUrl(
	baseUrl: string,
	path: string,
	searchParams?: Record<string, string>,
): URL {
	const url = new URL(`${baseUrl.replace(/\/+$/, "")}${path}`);

	for (const [key, value] of Object.entries(searchParams ?? {})) {
		url.searchParams.set(key, value);
	}

	return url;
}

/** The HTTP methods the jobs API's wire contract uses. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** One request against the jobs API. */
export type RequestOptions<T> = {
	method: HttpMethod;
	/** Unprefixed, matching Python's paths byte for byte — `/jobs/1/ping`. */
	path: string;
	body?: JsonValue;
	searchParams?: Record<string, string>;
	/** Schema the response body is parsed with. Omit for an empty response. */
	schema?: ZodType<T>;
	/** Attempts after the first. Defaults to 5; 0 for the ping loop, which owns its own policy. */
	retries?: number;
	/** Bounds this request on top of the run's cancellation signal. */
	signal?: AbortSignal;
};

/**
 * Authenticated client for one claimed job. One instance per run, created after
 * the claim because the key only exists from then on.
 */
export type JobsApiClient = {
	/**
	 * Generic authenticated request with retry and status mapping.
	 *
	 * The finalize, cache-register and metadata endpoints build on this rather
	 * than each hand-rolling auth, retry and error mapping.
	 */
	request: <T>(options: RequestOptions<T>) => Promise<T>;
	getJob: () => Promise<WorkflowJob>;
	/**
	 * Heartbeat.
	 *
	 * Takes a signal because the ping loop must be able to abandon a hung ping
	 * when it stops: the run's own signal is not aborted on a successful run, so
	 * without this the loop's `stop()` would wait out the 600 s request budget
	 * with the finish call queued behind it.
	 */
	ping: (signal?: AbortSignal) => Promise<JobPing>;
	startStep: (stepId: string) => Promise<void>;
	finish: () => Promise<void>;
	/** Closes the dispatcher. Called once at the end of a run. */
	close: () => Promise<void>;
};

/** Options for {@link createJobsApiClient}. */
export type CreateJobsApiClientOptions = {
	/** Cluster-internal jobs API service URL. Never the public web origin. */
	baseUrl: string;
	jobId: number;
	key: string;
	logger: Logger;
	/** The run's cancellation signal. Bounds every request. */
	signal: AbortSignal;
};

/**
 * The credential a workflow pod authenticates with.
 *
 * `job-{id}` is the handle the jobs API's key verification reserves for a
 * runner, matching Python's `BasicAuth(login=f"job-{job_id}", password=key)`.
 */
function buildAuthorization(jobId: number, key: string): string {
	return `Basic ${Buffer.from(`job-${jobId}:${key}`).toString("base64")}`;
}

/**
 * Bound a request by the overall budget, the run's cancellation, and whatever
 * the caller passed.
 */
function buildSignal(signals: (AbortSignal | undefined)[]): AbortSignal {
	return AbortSignal.any([
		AbortSignal.timeout(REQUEST_BUDGET_MS),
		...signals.filter((signal) => signal !== undefined),
	]);
}

export function createJobsApiClient({
	baseUrl,
	jobId,
	key,
	logger,
	signal: runSignal,
}: CreateJobsApiClientOptions): JobsApiClient {
	const dispatcher = createDispatcher();
	const authorization = buildAuthorization(jobId, key);

	async function attempt<T>({
		method,
		path,
		body,
		searchParams,
		schema,
		signal,
	}: RequestOptions<T>): Promise<T> {
		const headers: Record<string, string> = {
			accept: "application/json",
			authorization,
		};

		if (body !== undefined) {
			headers["content-type"] = "application/json";
		}

		let response: Awaited<ReturnType<typeof fetch>>;

		try {
			response = await fetch(joinUrl(baseUrl, path, searchParams), {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				dispatcher,
				signal: buildSignal([runSignal, signal]),
			});
		} catch (err) {
			// A run that was cancelled or terminated aborted this request itself.
			// Classifying that as a transport failure would retry it five times
			// against a signal that is never coming back.
			if (runSignal.aborted || signal?.aborted) {
				throw err;
			}

			throw new TransportError(
				`could not reach the jobs API at ${method} ${path}`,
				{ method, path, cause: err },
			);
		}

		await assertOkResponse(response, { method, path });

		if (!schema) {
			// Draining the body returns the socket to the pool. Leaving it open
			// costs a connection per lifecycle call for the length of a run.
			await response.text();

			return undefined as T;
		}

		const parsed = schema.safeParse(await response.json());

		if (!parsed.success) {
			throw new JobsApiError(
				`jobs API returned an unexpected body for ${method} ${path}: ${parsed.error.message}`,
				{ method, path, status: response.status, cause: parsed.error },
			);
		}

		return parsed.data;
	}

	function request<T>(options: RequestOptions<T>): Promise<T> {
		return withRetry(() => attempt(options), {
			logger,
			retries: options.retries,
			signal: runSignal,
		});
	}

	return {
		request,

		getJob: () =>
			request({ method: "GET", path: `/jobs/${jobId}`, schema: WorkflowJob }),

		// Retries are disabled so the ping loop owns the give-up window end to
		// end. Python's ping goes through `@retry`, so one failure as its loop
		// counts it costs 25 s of hidden retries first and the pod can go over two
		// minutes without a successful ping while believing it is healthy.
		ping: (signal) =>
			request({
				method: "PUT",
				path: `/jobs/${jobId}/ping`,
				schema: JobPing,
				retries: 0,
				signal,
			}),

		startStep: (stepId) =>
			request<void>({
				method: "POST",
				path: `/jobs/${jobId}/steps/${stepId}/start`,
				body: {},
			}),

		finish: () =>
			request<void>({ method: "POST", path: `/jobs/${jobId}/finish` }),

		close: () => dispatcher.close(),
	};
}
