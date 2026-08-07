import { isBearerTokenValid } from "@virtool/contracts/bearer";
import type { ProbeResponse } from "../probes";
import type { Metrics } from "./registry";

/** What {@link handleMetrics} needs to answer a scrape. */
export type MetricsDeps = {
	metrics: Metrics;
	/** The request's `Authorization` header, verbatim. */
	authorization: string | undefined;
	token: string | undefined;
};

/**
 * Answer a Prometheus scrape at `GET /metrics`.
 *
 * This process has no Service and is unreachable from outside the cluster, but
 * the token is not redundant: the listener answers anything that can route to
 * the pod IP. With no token configured it reports **404** rather than serving
 * openly, so an existing deployment does not start exposing internals on
 * upgrade; with a token configured and a wrong one presented it reports
 * **401**.
 *
 * `isBearerTokenValid` is shared with `apps/web` and `apps/jobs-api` rather
 * than reimplemented. It screens the length before `timingSafeEqual`, which
 * throws on a length mismatch — reducing the comparison to `===` reintroduces
 * the timing leak the shared helper exists to close.
 *
 * How these pods actually get scraped is unsettled. A `prometheus.io/scrape`
 * annotation needs no Service and yields genuine per-pod series, but cannot
 * carry a bearer token — under the semantics here that means no metrics at all
 * rather than open metrics. If that is the route taken, this handler needs a
 * deliberate third state; do not reach it by quietly dropping the gate.
 */
export async function handleMetrics(deps: MetricsDeps): Promise<ProbeResponse> {
	if (!deps.token) {
		return { status: 404, body: "Not Found", headers: {} };
	}

	if (!isBearerTokenValid(deps.authorization, deps.token)) {
		return {
			status: 401,
			body: "Unauthorized",
			headers: { "www-authenticate": "Bearer" },
		};
	}

	return {
		status: 200,
		body: await deps.metrics.render(),
		headers: { "content-type": deps.metrics.contentType },
	};
}
