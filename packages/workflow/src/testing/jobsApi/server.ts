/**
 * A real `node:http` server serving {@link handleJobsApiRequest} over
 * {@link JobsApiState}.
 *
 * This is what a **runtime** test gets. Retry, backoff, ping-driven
 * cancellation, credential handling and status-to-error mapping only mean
 * something over a real wire — a fetch mock would assert them into existence
 * rather than test them. It runs over the same state object the faked client
 * does, so a test can be moved between the two without rewriting its setup.
 */

import type { ServerResponse } from "node:http";
import {
	type RecordedRequest,
	respondJson,
	startTestServer,
	type TestServer,
} from "../http";
import { handleJobsApiRequest } from "./routes";
import type { JobsApiState } from "./state";

/** The one route reachable without credentials: the key comes back *from* it. */
const UNAUTHENTICATED = "/jobs/claim";

/** An embedded jobs API, plus the levers a retry or timeout test needs. */
export type JobsApiTestServer = TestServer & {
	/**
	 * Answer the next request with `status` instead of routing it.
	 *
	 * Queued, so several calls set up several requests in order — which is how a
	 * test drives the client's five retries and then lets the sixth attempt
	 * through.
	 */
	respondNextWith: (status: number, body?: unknown) => void;

	/**
	 * Hold the next request open and never answer it.
	 *
	 * The socket stays up, so this is a stalled response rather than a connection
	 * failure — the case a total request budget bounds and a connect timeout does
	 * not. Queued alongside {@link respondNextWith}.
	 */
	hangNextRequest: () => void;

	/**
	 * Destroy the next request's socket mid-connection.
	 *
	 * A genuine transport failure, which is the **only** thing the client retries
	 * — a status it chose is a decision, not a blip. Queued alongside the other
	 * two.
	 */
	destroyNextRequest: () => void;
};

type Override =
	| { kind: "status"; status: number; body: unknown }
	| { kind: "hang" }
	| { kind: "destroy" };

/**
 * Whether the request carries `job-{id}:{key}` over HTTP Basic.
 *
 * The credentials are checked rather than assumed, so the client's Basic
 * encoding is covered by a test instead of by a reading of the client's own
 * source.
 */
function isAuthorized(request: RecordedRequest, state: JobsApiState): boolean {
	const header = request.headers.authorization;

	if (typeof header !== "string" || !header.startsWith("Basic ")) {
		return false;
	}

	const decoded = Buffer.from(
		header.slice("Basic ".length),
		"base64",
	).toString();

	return decoded === `job-${state.job.id}:${state.key}`;
}

export async function startJobsApiTestServer(
	state: JobsApiState,
): Promise<JobsApiTestServer> {
	const overrides: Override[] = [];

	function handle(request: RecordedRequest, response: ServerResponse): void {
		const override = overrides.shift();

		if (override?.kind === "hang") {
			return;
		}

		if (override?.kind === "destroy") {
			response.destroy();

			return;
		}

		if (override?.kind === "status") {
			respondJson(response, override.status, override.body);

			return;
		}

		if (request.path !== UNAUTHENTICATED && !isAuthorized(request, state)) {
			// Opaque, matching the jobs API's guard. The one 401 that names
			// something is the terminal-state refusal, and that check sits behind
			// the key comparison in `handleJobsApiRequest`.
			respondJson(response, 401, { message: "Invalid credentials" });

			return;
		}

		const { status, body } = handleJobsApiRequest(state, {
			method: request.method,
			path: request.path,
			searchParams: request.searchParams,
			body: request.json,
		});

		respondJson(response, status, body);
	}

	const server = await startTestServer(handle);

	return {
		...server,

		respondNextWith(status, body = { message: `status ${status}` }) {
			overrides.push({ kind: "status", status, body });
		},

		hangNextRequest() {
			overrides.push({ kind: "hang" });
		},

		destroyNextRequest() {
			overrides.push({ kind: "destroy" });
		},
	};
}
