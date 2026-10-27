import {
	type ClaimableJobWorkflow,
	type CreateJobClaimRequest,
	JobClaimed,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { fetch } from "undici";
import { createDispatcher, joinUrl, REQUEST_BUDGET_MS } from "../client/client";
import { assertOkResponse, JobsApiError } from "../client/errors";
import { sleep } from "../client/retry";

/** Delay between claim attempts while no job is available. */
export const CLAIM_POLL_INTERVAL_MS = 2_000;

/**
 * Read a `Retry-After` given in seconds, as milliseconds.
 *
 * The jobs API sends one with every 503. The HTTP-date form is never sent, so
 * it is ignored along with anything else unparseable.
 */
function getRetryAfterMs(headers: {
	get: (name: string) => string | null;
}): number | undefined {
	const seconds = Number(headers.get("retry-after") ?? Number.NaN);

	return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/** Options for {@link claimJob}. */
export type ClaimJobOptions = {
	/** Cluster-internal jobs API service URL. Never the public web origin. */
	baseUrl: string;
	workflow: ClaimableJobWorkflow;
	request: CreateJobClaimRequest;
	logger: Logger;
	/** Bounds the whole poll. Carries both the claim timeout and SIGTERM. */
	signal: AbortSignal;
	pollIntervalMs?: number;
};

/**
 * Poll the jobs API until it hands this pod a job.
 *
 * The request is **unauthenticated** — the key comes back *from* the claim, so
 * there is nothing to authenticate with yet. A pod also learns its job id here
 * and nowhere else: a KEDA `ScaledJob` starts it with neither an id nor a key.
 *
 * @returns the claimed job, or `null` when the signal aborted before one was
 *   available. Abort is an ordinary outcome — a claim timeout and a SIGTERM
 *   both land here — so it is a return value rather than an exception.
 * @throws {JobsApiError} when the jobs API answers with a status other
 *   than 200, 404, or 503.
 */
export async function claimJob({
	baseUrl,
	workflow,
	request,
	logger,
	signal,
	pollIntervalMs = CLAIM_POLL_INTERVAL_MS,
}: ClaimJobOptions): Promise<JobClaimed | null> {
	const dispatcher = createDispatcher();

	const method = "POST";
	const path = "/jobs/claim";

	let unavailable = false;

	try {
		while (!signal.aborted) {
			try {
				const response = await fetch(
					// The workflow is a query parameter rather than a body field,
					// which is where `POST /jobs/claim` reads it from.
					joinUrl(baseUrl, path, { workflow }),
					{
						method,
						headers: {
							accept: "application/json",
							"content-type": "application/json",
						},
						body: JSON.stringify(request),
						dispatcher,
						signal: AbortSignal.any([
							AbortSignal.timeout(REQUEST_BUDGET_MS),
							signal,
						]),
					},
				);

				if (response.status === 200) {
					let body: unknown;

					try {
						body = await response.json();
					} catch (err) {
						// Left to the outer catch this would read as a connection blip,
						// and the runner would poll a broken or incompatible jobs API
						// until its timeout and then exit 0 as though no job had been
						// waiting.
						throw new JobsApiError(
							"jobs API returned a claim body that was not json",
							{ method, path, status: 200, cause: err },
						);
					}

					const parsed = JobClaimed.safeParse(body);

					if (!parsed.success) {
						throw new JobsApiError(
							`jobs API returned an unexpected claim body: ${parsed.error.message}`,
							{ method, path, status: 200, cause: parsed.error },
						);
					}

					logger.info(
						{ jobId: parsed.data.id, workflow },
						"claimed a job from the jobs API",
					);

					return parsed.data;
				}

				if (response.status === 404) {
					await response.text();

					unavailable = false;
				} else if (response.status === 503) {
					// The jobs API's database is restarting. Polling on outlasts it,
					// where throwing would exit the pod as broken. One warning per
					// outage is enough; every pod would otherwise log each poll.
					await response.text();

					if (!unavailable) {
						logger.warn(
							{ status: response.status },
							"jobs API is unavailable while claiming a job",
						);
					}

					unavailable = true;

					await sleep(
						getRetryAfterMs(response.headers) ?? pollIntervalMs,
						signal,
					);

					continue;
				} else {
					const body = await response.text();

					logger.error(
						{ status: response.status, body },
						"unexpected status while claiming a job",
					);

					await assertOkResponse(
						{ ok: false, status: response.status, text: async () => body },
						{ method, path },
					);
				}
			} catch (err) {
				if (err instanceof JobsApiError) {
					throw err;
				}

				if (signal.aborted) {
					break;
				}

				logger.warn(
					{ err },
					"could not reach the jobs API while claiming a job",
				);
			}

			await sleep(pollIntervalMs, signal);
		}

		return null;
	} finally {
		await dispatcher.close();
	}
}
