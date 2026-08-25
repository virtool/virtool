import type { Db } from "@virtool/data/db/pg";
import { jsonError } from "../http";
import { type JobPrincipal, verifyJobRequest } from "./verify";

/**
 * Resolve the job behind a request, or the response to refuse it with.
 *
 * The floor every handler in this service starts with. A handler calls it
 * first, returns the value straight back if it is a `Response`, and otherwise
 * carries on with the principal:
 *
 * ```ts
 * const principal = await requireJobRequest(db, request);
 *
 * if (principal instanceof Response) {
 * 	return principal;
 * }
 * ```
 *
 * The refusal is **returned, not thrown**. A thrown one would have to be caught
 * somewhere, and the somewhere that catches it is also the somewhere that
 * catches a genuine bug — so a handler that crashed halfway through would
 * answer 401 and read, to the runner and to Sentry alike, as a credential
 * problem.
 *
 * The 401 carries no `WWW-Authenticate` header. That header exists to make a
 * browser prompt for credentials, and nothing that reaches this service is a
 * browser. Sending it would only invite an interactive retry loop against a
 * service where the credential is minted once, at claim time.
 *
 * The body is a fixed string: a runner learns that it may not proceed, and
 * nothing about which of the checks turned it away.
 *
 * The exception is a job that has finished, which answers a JSON body naming
 * the state — `Job is cancelled.` A runner has no channel but this one to learn
 * it should stop, and three indistinguishable 401s would leave a cancellation,
 * a ping-timeout sweep and its own broken credential looking identical in the
 * logs. It gives a prober nothing, because it sits behind the key comparison;
 * see {@link verifyJobRequest}.
 */
export async function requireJobRequest(
	db: Db,
	request: Request,
): Promise<JobPrincipal | Response> {
	const result = await verifyJobRequest(db, request);

	if (result.ok) {
		return result.principal;
	}

	if (result.terminalMessage) {
		return jsonError(401, result.terminalMessage);
	}

	return new Response("Unauthorized", { status: 401 });
}
