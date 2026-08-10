/**
 * A `JobsApiClient` backed by {@link JobsApiState} and no socket.
 *
 * This is what a **workflow** test gets. A workflow test asks whether nuvs
 * produces the right results; HTTP only adds a wire format to break. Retry,
 * ping-driven cancellation and status-to-error mapping are a different question
 * and get the embedded server instead.
 *
 * It is not a shortcut around the contract. Every response goes through
 * `JSON.stringify` and back and is then parsed with the same schema the real
 * client parses the real service's response with, and every non-2xx status is
 * mapped by the same `assertOkResponse`. A fixture that answers with a shape the
 * contract does not describe fails here exactly as it would over a wire.
 */

import { JobPing, WorkflowJob } from "@virtool/contracts";
import type { JobsApiClient, RequestOptions } from "../../client/client";
import { assertOkResponse, JobsApiError } from "../../client/errors";
import { handleJobsApiRequest } from "./routes";
import type { JobsApiState } from "./state";

/**
 * A faked client, plus the state it reads.
 *
 * The state is the assertion surface — `stepStartUpdates`, `finishCalled`,
 * `finalizeCalls`, `cacheRegistrations` — so a workflow test asserts on what was
 * registered without standing a server up.
 */
export type FakeJobsApiClient = JobsApiClient & {
	state: JobsApiState;
	/** Every request the fake was asked to make, in order. */
	requests: () => readonly { method: string; path: string }[];
};

export function createFakeJobsApiClient(
	state: JobsApiState,
): FakeJobsApiClient {
	const requests: { method: string; path: string }[] = [];

	async function request<T>({
		method,
		path,
		body,
		schema,
		signal,
	}: RequestOptions<T>): Promise<T> {
		requests.push({ method, path });

		// The run's signal reaches a faked call the same way it reaches a real
		// one, so a test can cancel mid-run without the fake carrying on.
		signal?.throwIfAborted();

		const { status, body: responseBody } = handleJobsApiRequest(state, {
			method,
			path,
			// The route table parses what a real handler would receive, which is
			// the serialized body — a `Date` in a manifest has already become a
			// string by the time it arrives.
			body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
		});

		const serialized = JSON.stringify(responseBody);

		await assertOkResponse(
			{
				ok: status >= 200 && status < 300,
				status,
				text: async () => serialized,
			},
			{ method, path },
		);

		if (!schema) {
			return undefined as T;
		}

		const parsed = schema.safeParse(JSON.parse(serialized));

		if (!parsed.success) {
			throw new JobsApiError(
				`jobs API returned an unexpected body for ${method} ${path}: ${parsed.error.message}`,
				{ method, path, status, cause: parsed.error },
			);
		}

		return parsed.data;
	}

	const jobId = state.job.id;

	return {
		state,
		requests: () => requests,

		request,

		getJob: () =>
			request({ method: "GET", path: `/jobs/${jobId}`, schema: WorkflowJob }),

		ping: (signal) =>
			request({
				method: "PUT",
				path: `/jobs/${jobId}/ping`,
				schema: JobPing,
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

		close: () => Promise.resolve(),
	};
}
