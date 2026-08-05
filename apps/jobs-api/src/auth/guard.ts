import type { Db } from "@virtool/data/db/pg";
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
 * The body is a fixed string for the same reason {@link verifyJobRequest}
 * returns a bare `null`: a runner learns that it may not proceed, and nothing
 * about which of the checks turned it away.
 */
export async function requireJobRequest(
	db: Db,
	request: Request,
): Promise<JobPrincipal | Response> {
	const principal = await verifyJobRequest(db, request);

	if (!principal) {
		return new Response("Unauthorized", { status: 401 });
	}

	return principal;
}
