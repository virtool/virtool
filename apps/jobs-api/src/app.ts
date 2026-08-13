import type { Db, PgClient } from "@virtool/data/db/pg";
import { checkPostgres, summarizeReadiness } from "@virtool/data/health/data";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { Hono } from "hono";
import { routePath } from "hono/route";
import { handleFinalizeAnalysis, handleGetAnalysis } from "./analyses/handlers";
import { handleGetCache, handleRegisterCache } from "./caches/handlers";
import { jsonError } from "./http";
import { handleGetIndex } from "./indexes/handlers";
import { handleReadJobCounts } from "./jobs/counts";
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
import { handleFinalizeSample, handleGetSample } from "./samples/handlers";
import { handleGetSettings } from "./settings/handlers";
import {
	handleFinalizeSubtraction,
	handleGetSubtraction,
} from "./subtraction/handlers";

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
 * `GET /jobs/counts` is public on the same two grounds. The KEDA scaler that
 * reads it holds no job key and could not: a key is minted at claim time, which
 * is the thing it is deciding whether to start a pod to do. Python's
 * `JobsCountsView` carries `PublicRoutePolicy`, and what it discloses is queue
 * depth per workflow — nothing about a job, a sample or a user.
 *
 * `/metrics` is deliberately **not** here: it enforces its own bearer token and
 * is expected to refuse like everything else.
 */
export const PUBLIC_ROUTES = [
	"/health/live",
	"/health/ready",
	"/jobs/claim",
	"/jobs/counts",
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
	/**
	 * Whether this process is still accepting work.
	 *
	 * Flipped to `false` the moment shutdown begins, so `/health/ready` reports
	 * 503 while the listener is still up to say so.
	 */
	isReady: () => boolean;
	/**
	 * Report an unhandled error to Sentry.
	 *
	 * Injected rather than imported so `app.ts` carries no dependency on
	 * `@sentry/node` — the SDK's graph stays out of the test path, and "did we
	 * report it?" is assertable with a `vi.fn()`. Optional because a test app
	 * has nothing to report to.
	 */
	captureException?: (err: unknown) => void;
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
				// `c.res` is a lazy getter that mints an empty 200 when nothing has
				// set a response, so reading it unconditionally counts a request that
				// crashed as one that succeeded. `c.finalized` is what says a response
				// was actually set, and it is the whole gate: a handler that throws an
				// `Error` is caught by Hono's `compose`, which calls `app.onError` and
				// finalizes its 500 before `next()` resolves — so that request is
				// labelled `"500"`, which is what the caller saw.
				//
				// What is left for the `"error"` sentinel is a request that produced no
				// response at all. A non-`Error` throw is the one that gets there:
				// `compose` rethrows it without setting `c.error` and without reaching
				// `onError`, whose guard is `err instanceof Error`. The sentinel is
				// bounded, and it keeps the counter's total honest.
				status: c.finalized ? String(c.res.status) : "error",
				durationSeconds: (performance.now() - start) / 1000,
			});
		}
	});

	// Hono catches a thrown handler itself, so the error never reaches Node's
	// `uncaughtException` and the Sentry SDK's global handlers never see it.
	// Without this the only trace of a bug in a route is Hono's default
	// `console.error` and a plain-text 500: no pino line, and nothing in Sentry.
	//
	// The route label is `routePath(c, -1)` for the same reason the metrics
	// middleware uses it — the registered pattern, never the request path, which
	// carries ids.
	app.onError((err, c) => {
		deps.logger.error(
			{ err, method: c.req.method, route: routePath(c, -1) },
			"unhandled error",
		);

		deps.captureException?.(err);

		return jsonError(500, "Internal server error");
	});

	app.get("/health/live", (c) => c.json({ status: "alive" }));

	// Reports 503 from the moment shutdown begins, before the listener closes and
	// without querying, so the kubelet takes the pod out of the Service's
	// endpoints while there is still something there to answer. A claim that
	// arrived after that would be held by a process on its way out.
	app.get("/health/ready", async (c) => {
		if (!deps.isReady()) {
			return c.json({ status: "unavailable", checks: {} }, 503);
		}

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

	// Queue depth, for the KEDA `ScaledJob` that starts workflow pods. Not part
	// of the lifecycle — nothing a runner calls — but it lives on `/jobs` because
	// Python serves it there and the scaler's trigger names the path.
	//
	// It cannot collide with `/jobs/:jobId` for the reason above, and the
	// collision is worth naming: before this route existed, a poll for
	// `/jobs/counts` matched the parameter route, was refused by the job guard,
	// and reported to the scaler as `api returned 401` — a credential problem
	// where the truth was a missing endpoint.
	app.get("/jobs/counts", () => handleReadJobCounts(readJobQueue));

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

	// The metadata reads. A running workflow needs the records behind its job —
	// what to align against, what to subtract, where the reads are — and it needs
	// them as records only: it holds its own object-storage credentials and
	// fetches every file itself using the `storageKey` each response carries.
	// Nothing here writes a row, writes a blob, or builds a derived artifact.
	app.get("/samples/:id", (c) =>
		handleGetSample(deps, c.req.raw, c.req.param("id")),
	);

	app.get("/subtractions/:id", (c) =>
		handleGetSubtraction(deps, c.req.raw, c.req.param("id")),
	);

	app.get("/indexes/:id", (c) =>
		handleGetIndex(deps, c.req.raw, c.req.param("id")),
	);

	app.get("/analyses/:id", (c) =>
		handleGetAnalysis(deps, c.req.raw, c.req.param("id")),
	);

	app.get("/settings", (c) => handleGetSettings(deps, c.req.raw));

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
