import {
	type CreateJobClaimRequest,
	JobClaimed,
	type JobWorkflow,
} from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { fetch } from "undici";
import { createDispatcher, joinUrl, REQUEST_BUDGET_MS } from "../client/client";
import { assertOkResponse, JobsApiError } from "../client/errors";
import { sleep } from "../client/retry";

/** Seconds between claim attempts, matching `acquire.py`'s `poll_interval`. */
export const CLAIM_POLL_INTERVAL_MS = 2_000;

/** Options for {@link claimJob}. */
export type ClaimJobOptions = {
	/** Cluster-internal jobs API service URL. Never the public web origin. */
	baseUrl: string;
	workflow: JobWorkflow;
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
 *   than 200 or 404.
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

	try {
		while (!signal.aborted) {
			try {
				const response = await fetch(
					// The workflow is a query parameter rather than a body field,
					// matching Python's `ClaimJobView`.
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
