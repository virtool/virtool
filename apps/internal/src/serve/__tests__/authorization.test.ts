import type { Db, PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { describe, expect, it, vi } from "vitest";
import { type AppDeps, createApp, PUBLIC_ROUTES } from "../app";
import { createMetrics } from "../metrics/registry";

const METRICS_TOKEN = "a-metrics-token";

/**
 * Statuses that count as refusing an unauthenticated caller.
 *
 * 404 is in the set because that is how an unconfigured `/metrics` declines —
 * withholding even the fact that the endpoint exists — and it is a refusal in
 * the sense this test cares about: nothing privileged was served.
 */
const REFUSALS = [401, 403, 404];

/**
 * A postgres.js client stand-in.
 *
 * The real thing is called as a tagged template, so a plain function is enough
 * for the two queries this app makes. Nothing here should reach it — a route
 * that refuses should refuse before touching the database.
 */
function fakeClient(): PgClient {
	return (() => Promise.resolve([])) as unknown as PgClient;
}

/**
 * A Drizzle handle stand-in.
 *
 * Nothing here should reach it either: an unauthenticated request is turned
 * away by the guard before it reads a job row, so a handler that queries
 * through this throws rather than quietly passing the test.
 */
function fakeDb(): Db {
	return new Proxy(
		{},
		{
			get() {
				throw new Error("a refused request must not query the database");
			},
		},
	) as Db;
}

function fakeLogger(): Logger {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	} as unknown as Logger;
}

function deps(overrides: Partial<AppDeps> = {}): AppDeps {
	return {
		client: fakeClient(),
		db: fakeDb(),
		storage: new MemoryStorage(),
		logger: fakeLogger(),
		metrics: createMetrics(10, "1.2.3"),
		applicationName: "virtool-ts-jobs-api@test",
		metricsToken: METRICS_TOKEN,
		isReady: () => true,
		...overrides,
	};
}

/**
 * The app's endpoints, as registered.
 *
 * `app.routes` also carries the global metrics middleware, which is mounted at
 * `/*` and is not an endpoint. Filtering it out by path keeps the list to
 * things a caller can actually request.
 */
function endpoints(app: ReturnType<typeof createApp>) {
	return app.routes.filter((route) => route.path !== "/*");
}

describe("authorization", () => {
	// The floor. Every route this service exposes either refuses an
	// unauthenticated caller or is named in PUBLIC_ROUTES with a reason. A new
	// route added without either fails here, by name, rather than shipping open
	// to a service whose whole premise is that its surface is guarded.
	it.each(
		endpoints(createApp(deps())).map((route) => [route.method, route.path]),
	)(
		"%s %s refuses an unauthenticated request or is explicitly public",
		async (method, path) => {
			const app = createApp(deps());
			const response = await app.request(path, { method });

			if ((PUBLIC_ROUTES as readonly string[]).includes(path)) {
				expect(response.status).not.toBe(401);
				return;
			}

			expect(REFUSALS).toContain(response.status);
		},
	);

	// A stale exception is as much a bug as a missing one: it reads as a
	// deliberate decision about a route that no longer exists.
	it.each(PUBLIC_ROUTES)("%s is a route that actually exists", (path) => {
		const paths = endpoints(createApp(deps())).map((route) => route.path);

		expect(paths).toContain(path);
	});
});

describe("health", () => {
	it("reports alive without a credential", async () => {
		const response = await createApp(deps()).request("/health/live");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "alive" });
	});

	it("reports ready when postgres answers", async () => {
		const response = await createApp(deps()).request("/health/ready");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "ready",
			checks: { postgres: { ok: true } },
		});
	});

	// The readiness probe is what takes a pod out of service, so an unreachable
	// database has to reach the kubelet as 503 rather than as a 200 with a sad
	// body.
	it("reports unavailable when postgres does not answer", async () => {
		const client = (() =>
			Promise.reject(new Error("down"))) as unknown as PgClient;

		const response = await createApp(deps({ client })).request("/health/ready");

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: "unavailable",
			checks: { postgres: { ok: false } },
		});
	});

	// The shutdown sequence flips readiness before it closes anything, so this is
	// the window in which the kubelet has to learn the pod is going away — with
	// the listener still up to tell it.
	it("reports unavailable from the moment shutdown begins", async () => {
		const app = createApp(deps({ isReady: () => false }));

		const response = await app.request("/health/ready");

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: "unavailable",
			checks: {},
		});
	});

	// Answering has to cost nothing: a pod winding down should not be waiting on
	// a query it is about to close the pool on. `fakeDb`-style throwing is not
	// enough here — the check is that the client is never called at all.
	it("does not query postgres once shutdown has begun", async () => {
		const client = vi.fn(() => Promise.resolve([])) as unknown as PgClient;

		await createApp(deps({ client, isReady: () => false })).request(
			"/health/ready",
		);

		expect(client).not.toHaveBeenCalled();
	});
});

describe("metrics", () => {
	// Unset means off, not open. An existing deployment must not start exposing
	// internals merely by upgrading to a build that has the endpoint.
	it("reports 404 when no token is configured", async () => {
		const app = createApp(deps({ metricsToken: undefined }));

		const response = await app.request("/metrics", {
			headers: { authorization: `Bearer ${METRICS_TOKEN}` },
		});

		expect(response.status).toBe(404);
	});

	it("reports 401 without a token", async () => {
		const response = await createApp(deps()).request("/metrics");

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Bearer");
	});

	it("reports 401 for a wrong token", async () => {
		const app = createApp(deps());

		const response = await app.request("/metrics", {
			headers: { authorization: "Bearer not-the-token" },
		});

		expect(response.status).toBe(401);
	});

	it("serves the exposition for the configured token", async () => {
		const app = createApp(deps());

		const response = await app.request("/metrics", {
			headers: { authorization: `Bearer ${METRICS_TOKEN}` },
		});

		expect(response.status).toBe(200);

		const rendered = await response.text();

		expect(rendered).toContain("virtool_postgres_pool_max 10");
		expect(rendered).toContain('virtool_app_info{version="1.2.3"} 1');
	});

	// A Postgres outage is exactly when the process and request metrics matter
	// most. `fakeDb` throws on every property access, so this scrape is one where
	// both database-backed reads fail; the rest of the exposition must survive.
	it("still renders when the database-backed reads fail", async () => {
		const app = createApp(deps());

		const response = await app.request("/metrics", {
			headers: { authorization: `Bearer ${METRICS_TOKEN}` },
		});
		const rendered = await response.text();

		expect(response.status).toBe(200);
		expect(rendered).toContain("process_cpu_seconds_total");
		expect(rendered).toContain("virtool_http_requests_total");

		// The queue series are dropped rather than served stale, so a scrape
		// during an outage records no depth at all.
		expect(rendered).not.toContain("virtool_jobs{");
	});
});

describe("unhandled errors", () => {
	/**
	 * An app with one route that always throws.
	 *
	 * Registered after `createApp` so the failure comes from a real handler
	 * running under the app's own middleware and error handler, rather than from
	 * a stubbed Hono.
	 */
	function throwingApp(overrides: Partial<AppDeps> = {}) {
		const app = createApp(deps(overrides));

		app.get("/boom", () => {
			throw new Error("boom");
		});

		return app;
	}

	// Hono's default handler answers plain text. A caller parsing every other
	// refusal in this service as JSON would then fail on the one response it has
	// least context for.
	it("answers a JSON 500", async () => {
		const response = await throwingApp().request("/boom");

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ message: "Internal server error" });
	});

	it("logs the failure against a bounded route pattern", async () => {
		const logger = fakeLogger();

		await throwingApp({ logger }).request("/boom");

		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				err: expect.objectContaining({ message: "boom" }),
				method: "GET",
				route: "/boom",
			}),
			"unhandled error",
		);
	});

	// Hono catches before the error can reach Node, so this hook is the only way
	// a bug in a route becomes a Sentry event.
	it("reports the error through the injected hook", async () => {
		const captureException = vi.fn();

		await throwingApp({ captureException }).request("/boom");

		expect(captureException).toHaveBeenCalledWith(
			expect.objectContaining({ message: "boom" }),
		);
	});
});

describe("request metrics", () => {
	// Ids in a label would grow one time series per job. The registered pattern
	// is bounded by the number of routes instead.
	it("labels a matched route with its pattern, not the requested path", async () => {
		const metrics = createMetrics(10, "1.2.3");
		const app = createApp(deps({ metrics }));

		await app.request("/jobs/12345");

		const rendered = await metrics.render();

		expect(rendered).toContain('route="/jobs/:jobId"');
		expect(rendered).not.toContain("12345");
	});

	it("counts a handled request under its own route", async () => {
		const metrics = createMetrics(10, "1.2.3");
		const app = createApp(deps({ metrics }));

		await app.request("/health/live");

		expect(await metrics.render()).toContain('route="/health/live"');
	});

	// A path matching no route falls through to the middleware's own `/*`, which
	// is a pattern rather than a path and so is bounded like every other label.
	it("counts a genuinely unmatched path under the middleware's pattern", async () => {
		const metrics = createMetrics(10, "1.2.3");
		const app = createApp(deps({ metrics }));

		await app.request("/no-such-route");

		const rendered = await metrics.render();

		expect(rendered).toContain('route="/*",method="GET",status="404"');
		expect(rendered).not.toContain("no-such-route");
	});

	// `app.onError` turns a thrown `Error` into a real 500, so the counter records
	// the status the caller actually got. The `"error"` sentinel is for the case
	// where there is no status at all, below.
	it("counts a thrown Error under the status onError answered with", async () => {
		const metrics = createMetrics(10, "1.2.3");
		const app = createApp(deps({ metrics }));

		app.get("/boom", () => {
			throw new Error("boom");
		});

		await app.request("/boom");

		expect(await metrics.render()).toContain(
			'route="/boom",method="GET",status="500"',
		);
	});

	// Hono's `compose` rethrows a non-`Error` throw without setting `c.error` and
	// without reaching `onError`, whose guard is `err instanceof Error`. Nothing
	// finalizes a response, and `c.res`'s getter would mint an empty 200 — so
	// without the `finalized` gate a crashed request is counted as a success.
	it("counts a non-Error throw under the error sentinel", async () => {
		const metrics = createMetrics(10, "1.2.3");
		const app = createApp(deps({ metrics }));

		app.get("/boom", () => {
			throw undefined;
		});

		await expect(app.request("/boom")).rejects.toBeUndefined();

		expect(await metrics.render()).toContain(
			'route="/boom",method="GET",status="error"',
		);
	});
});
