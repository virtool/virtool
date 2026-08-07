import { createServer, type Server } from "node:http";
import type { PgClient } from "@virtool/data/db/pg";
import { checkPostgres, summarizeReadiness } from "@virtool/data/health/data";
import type { Logger } from "@virtool/logger";
import { handleMetrics } from "./metrics/handler";
import type { Metrics } from "./metrics/registry";

/** A response the probe listener writes out verbatim. */
export type ProbeResponse = {
	status: number;
	body: string;
	headers: Record<string, string>;
};

/** What {@link createProbeServer} needs to answer a probe. */
export type ProbeDeps = {
	client: PgClient;
	logger: Logger;
	metrics: Metrics;
	metricsToken: string | undefined;
	/** Whether this process is currently accepting work. */
	isReady: () => boolean;
};

function json(status: number, value: unknown): ProbeResponse {
	return {
		status,
		body: JSON.stringify(value),
		headers: { "content-type": "application/json" },
	};
}

/**
 * Answer `GET /health/live`.
 *
 * **Static, with no dependency of any kind — above all not Postgres.** A
 * liveness probe that queries the database restarts the entire fleet on a
 * twenty-second database blip, killing every task in flight to fix nothing.
 * The same reasoning is why a CPU-bound task body must not be able to fail this
 * either. Adding a check here is not an improvement; it is the failure mode.
 */
function handleLive(): ProbeResponse {
	return json(200, { status: "alive" });
}

/**
 * Answer `GET /health/ready`.
 *
 * Readiness earns its place where liveness does not: it drives a Deployment's
 * `availableReplicas` and so its rollout progress, `minReadySeconds`, and PDB
 * counting — all of which matter even though this process has no Service.
 * Without it, a pod is Ready the moment the container starts, and against
 * `maxUnavailable: 0` that is the difference between a safe rollout and a blind
 * one.
 *
 * It reports 503 from the moment shutdown begins, before any hook has run, so
 * the kubelet learns the pod is going away while the listener is still up to
 * say so.
 */
async function handleReady(deps: ProbeDeps): Promise<ProbeResponse> {
	if (!deps.isReady()) {
		return json(503, { status: "unavailable", checks: {} });
	}

	const report = summarizeReadiness(
		await checkPostgres(deps.client, deps.logger),
	);

	return json(report.statusCode, {
		status: report.status,
		checks: report.checks,
	});
}

async function route(
	deps: ProbeDeps,
	method: string | undefined,
	url: string | undefined,
	authorization: string | undefined,
): Promise<ProbeResponse> {
	// Query strings and trailing junk are not part of any probe's contract, and
	// the kubelet sends neither. Match the path alone.
	const path = (url ?? "").split("?")[0];

	if (method !== "GET") {
		return { status: 404, body: "Not Found", headers: {} };
	}

	if (path === "/health/live") {
		return handleLive();
	}

	if (path === "/health/ready") {
		return handleReady(deps);
	}

	if (path === "/metrics") {
		return handleMetrics({
			metrics: deps.metrics,
			authorization,
			token: deps.metricsToken,
		});
	}

	return { status: 404, body: "Not Found", headers: {} };
}

/**
 * Build the probe and metrics listener.
 *
 * A plain `node:http` server rather than a framework: three routes and a 404
 * do not earn a dependency, and this process serves no traffic. It is created
 * unstarted so the caller decides when to listen — `bootstrap` starts it last,
 * after everything it reports on already exists.
 */
export function createProbeServer(deps: ProbeDeps): Server {
	return createServer((req, res) => {
		route(deps, req.method, req.url, req.headers.authorization).then(
			(response) => {
				res.writeHead(response.status, response.headers);
				res.end(response.body);
			},
			(err) => {
				// A probe handler that throws must still answer. A socket left hanging
				// reads to the kubelet as a timeout, which for liveness means a
				// restart — the outcome the static handler above exists to avoid.
				deps.logger.error({ err, url: req.url }, "probe handler failed");
				res.writeHead(500, {});
				res.end("Internal Server Error");
			},
		);
	});
}
