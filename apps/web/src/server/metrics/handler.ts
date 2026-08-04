import { timingSafeEqual } from "node:crypto";
import { readConnectionCounts } from "@virtool/data/metrics/data";
import { applicationName, client } from "../composition";
import { config } from "../config";
import { logger } from "../logger";
import {
	metricsContentType,
	renderMetrics,
	setPostgresConnections,
} from "./registry";

const BEARER_PREFIX = "bearer ";

/**
 * How long a scrape waits on the pool probe before abandoning it.
 *
 * The probe is a query on the very pool it measures, so a saturated pool queues
 * it *client-side*, where nothing rejects and no statement timeout applies. Left
 * unbounded it would hang past Prometheus' scrape deadline and lose the whole
 * response — the process and request metrics included — exactly when saturation
 * is the thing worth seeing. Two seconds sits well inside a default 10s scrape
 * timeout.
 */
const POOL_PROBE_TIMEOUT_MS = 2000;

/**
 * Resolve `promise`, or reject once `ms` have passed.
 *
 * The abandoned promise is left to settle on its own; it is a single trivial
 * query and its result is simply discarded.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error("timed out")), ms);
	});

	return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Compare the presented bearer token to the configured one without leaking
 * where they first differ.
 *
 * `timingSafeEqual` throws on a length mismatch, so that case is screened
 * first. The screen reveals the configured token's length, which is not worth
 * defending: an attacker learns nothing that narrows the search meaningfully.
 *
 * The scheme is matched case-insensitively, as RFC 9110 §11.1 requires. The
 * credential after it is not — it is compared byte for byte, so a token that
 * differs only in case or surrounding whitespace is a different token.
 */
function isAuthorized(request: Request, token: string): boolean {
	const header = request.headers.get("authorization");

	if (header?.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX) {
		return false;
	}

	const presented = Buffer.from(header.slice(BEARER_PREFIX.length));
	const expected = Buffer.from(token);

	if (presented.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(presented, expected);
}

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

	if (!isAuthorized(request, token)) {
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
			await withTimeout(
				readConnectionCounts(client, applicationName),
				POOL_PROBE_TIMEOUT_MS,
			),
		);
	} catch (err) {
		logger.warn({ err }, "could not read postgres connection counts");
	}

	return new Response(await renderMetrics(), {
		headers: { "content-type": metricsContentType },
	});
}
