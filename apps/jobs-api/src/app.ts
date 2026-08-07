import type { Db, PgClient } from "@virtool/data/db/pg";
import { checkPostgres, summarizeReadiness } from "@virtool/data/health/data";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { Hono } from "hono";
import { routePath } from "hono/route";
import { handleFinalizeAnalysis } from "./analyses/handlers";
import { handleGetCache, handleRegisterCache } from "./caches/handlers";
import {
	handleClaimJob,
	handleFinishJob,
	handlePingJob,
	handleReadJob,
	handleStartJobStep,
} from "./jobs/handlers";
import { handleMetrics } from "./metrics/handler";
import { createJobQueueReader } from "./metrics/jobs";
import type { Metrics } from "./metrics/registry";
import { handleFinalizeSample } from "./samples/handlers";
import { handleFinalizeSubtraction } from "./subtraction/handlers";

/**
 * The routes that answer without a credential, and why each is allowed to.
 *
 * `authorization.test.ts` enumerates the app's routes and requires every one
 * not named here to refuse an unauthenticated request. Adding a route without
 * an authorization floor therefore fails the build by name, rather than
 * shipping an open endpoint to a service whose whole premise is that its
 * surface is guarded.
 *
 * The first two are Kubernetes probes. The kubelet presents no credential, and a
 * readiness probe that could fail closed on an auth problem would take the pod
 * out of service for the wrong reason. Neither reveals anything beyond whether
 * Postgres answers.
 *
 * `POST /jobs/claim` is public because it **has** to be: the key a runner
 * authenticates every later request with is minted by that call and returned in
 * its response, so a caller has nothing to present yet. A pod started by a KEDA
 * `ScaledJob` knows neither its job id nor its key until it claims. Python's
 * `ClaimJobView` carries `PublicRoutePolicy` for the same reason. What bounds it
 * is the network: this service has no ingress, so reaching the endpoint at all
 * means already being inside the cluster.
 *
 * `/metrics` is deliberately **not** here: it enforces its own bearer token and
 * is expected to refuse like everything else.
 */
export const PUBLIC_ROUTES = [
	"/health/live",
	"/health/ready",
	"/jobs/claim",
] as const;

/** What {@link createApp} needs to serve. */
export type AppDeps = {
	client: PgClient;
	db: Db;
	storage: StorageBackend;
	logger: Logger;
	metrics: Metrics;
	applicationName: string;
	metricsToken: string | undefined;
};

/**
 * Build the jobs API's Hono app.
 *
 * A factory rather than a module-scope singleton so a test can construct one
 * over fakes without opening a pool, and so nothing is built at import time —
 * the same rule `@virtool/data` and `@virtool/storage` follow.
 *
 * Hono is the framework here because the raw-route handlers this service will
 * grow are already written against Web `Request`/`Response`, and port across
 * verbatim.
 */
export function createApp(deps: AppDeps): Hono {
	const app = new Hono();

	// Built once per app rather than per scrape: the memo is the whole point, and
	// one created inside the handler would be discarded before the next scrape
	// could reuse it.
	const readJobQueue = createJobQueueReader(deps.db);

	// Every request, including ones that fall through to 404. `routePath` yields
	// the *registered pattern* — `/jobs/:jobId`, never `/jobs/1234` — which is
	// what keeps the label bounded by the number of routes rather than by the
	// number of jobs.
	app.use("*", async (c, next) => {
		const start = performance.now();

		try {
			await next();
		} finally {
			deps.metrics.recordHttpRequest({
				method: c.req.method,
				route: routePath(c, -1),
				// A thrown handler leaves no status behind. `"error"` is a bounded
				// sentinel and keeps the counter's total honest either way.
				status: c.error ? "error" : String(c.res.status),
				durationSeconds: (performance.now() - start) / 1000,
			});
		}
	});

	app.get("/health/live", (c) => c.json({ status: "alive" }));

	app.get("/health/ready", async (c) => {
		const report = summarizeReadiness(
			await checkPostgres(deps.client, deps.logger),
		);

		return c.json(
			{ status: report.status, checks: report.checks },
			report.statusCode,
		);
	});

	// The job lifecycle: claim, read, heartbeat, step start, finish. There is
	// deliberately no failure route and no delete — a job fails by being
	// cancelled or by Python's stalled-job sweep, neither of which a runner
	// drives.
	//
	// `/jobs/claim` cannot collide with `/jobs/:jobId`: nothing serves POST on
	// the latter, and Hono prefers a static segment over a parameter regardless.
	app.post("/jobs/claim", (c) => handleClaimJob(deps, c.req.raw));

	app.get("/jobs/:jobId", (c) =>
		handleReadJob(deps, c.req.raw, c.req.param("jobId")),
	);

	app.put("/jobs/:jobId/ping", (c) =>
		handlePingJob(deps, c.req.raw, c.req.param("jobId")),
	);

	app.post("/jobs/:jobId/steps/:stepId/start", (c) =>
		handleStartJobStep(
			deps,
			c.req.raw,
			c.req.param("jobId"),
			c.req.param("stepId"),
		),
	);

	app.post("/jobs/:jobId/finish", (c) =>
		handleFinishJob(deps, c.req.raw, c.req.param("jobId")),
	);

	// Python serves these at the same paths, with no prefix — a separate app has
	// no SPA to collide with. Each handler calls the job-auth guard itself;
	// nothing here runs middleware on its behalf.
	app.get("/caches/:key", (c) =>
		handleGetCache(deps, c.req.raw, c.req.param("key")),
	);

	app.post("/caches", (c) => handleRegisterCache(deps, c.req.raw));

	// The three finalize routes. Each is the single call that ends a workflow:
	// the resource's own fields and the list of objects it wrote, so a run cannot
	// end with the parent flipped ready and its file rows missing.
	app.patch("/subtractions/:id", (c) =>
		handleFinalizeSubtraction(deps, c.req.raw, c.req.param("id")),
	);

	app.patch("/samples/:id", (c) =>
		handleFinalizeSample(deps, c.req.raw, c.req.param("id")),
	);

	app.patch("/analyses/:id", (c) =>
		handleFinalizeAnalysis(deps, c.req.raw, c.req.param("id")),
	);

	app.get("/metrics", (c) =>
		handleMetrics(c, {
			metrics: deps.metrics,
			client: deps.client,
			applicationName: deps.applicationName,
			readJobQueue,
			logger: deps.logger,
			token: deps.metricsToken,
		}),
	);

	return app;
}
