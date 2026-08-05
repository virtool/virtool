import { isBearerTokenValid } from "@virtool/contracts/bearer";
import { readConnectionCountsBounded } from "@virtool/data/metrics/data";
import { applicationName, client } from "../composition";
import { config } from "../config";
import { logger } from "../logger";
import {
	metricsContentType,
	renderMetrics,
	setPostgresConnections,
} from "./registry";

/**
 * Serve the Prometheus scrape endpoint backing `GET /metrics`.
 *
 * A raw route rather than a server function, because Prometheus scrapes over
 * plain HTTP and cannot speak the generated RPC client. That also means no
 * policy middleware runs, so the authorization floor is enforced here — as it
 * is in `handleUpload` — against `VT_METRICS_TOKEN`.
 *
 * The server listens on a single port, so this endpoint shares a socket with
 * the app itself and would otherwise be reachable by anyone who guesses the
 * path. With no token configured it reports 404 rather than serving openly, so
 * an existing deployment does not start exposing internals on upgrade.
 */
export async function handleMetrics(request: Request): Promise<Response> {
	const token = config.metricsToken;

	if (!token) {
		return new Response("Not Found", { status: 404 });
	}

	if (!isBearerTokenValid(request.headers.get("authorization"), token)) {
		return new Response("Unauthorized", {
			status: 401,
			headers: { "www-authenticate": "Bearer" },
		});
	}

	// A Postgres outage is exactly when the rest of these metrics matter most,
	// so a failed or slow read drops the pool gauges rather than the whole
	// scrape. The series go stale at their last value; `up` and the process
	// metrics carry on.
	try {
		setPostgresConnections(
			await readConnectionCountsBounded(client, applicationName),
		);
	} catch (err) {
		logger.warn({ err }, "could not read postgres connection counts");
	}

	return new Response(await renderMetrics(), {
		headers: { "content-type": metricsContentType },
	});
}
