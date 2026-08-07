import type { Db, PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { describe, expect, it } from "vitest";
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
	const noop = () => undefined;
	return {
		info: noop,
		warn: noop,
		error: noop,
		debug: noop,
	} as unknown as Logger;
}

function deps(overrides: Partial<AppDeps> = {}): AppDeps {
	return {
		client: fakeClient(),
		db: fakeDb(),
		storage: new MemoryStorage(),
		logger: fakeLogger(),
		metrics: createMetrics(10),
		applicationName: "virtool-ts-jobs-api@test",
		metricsToken: METRICS_TOKEN,
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
		expect(await response.text()).toContain("virtool_postgres_pool_max 10");
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

describe("request metrics", () => {
	// Ids in a label would grow one time series per job. The registered pattern
	// is bounded by the number of routes instead.
	it("labels an unmatched path with a bounded route pattern", async () => {
		const metrics = createMetrics(10);
		const app = createApp(deps({ metrics }));

		await app.request("/jobs/12345");

		const rendered = await metrics.render();

		expect(rendered).not.toContain("12345");
		expect(rendered).toContain("virtool_http_requests_total");
	});

	it("counts a handled request under its own route", async () => {
		const metrics = createMetrics(10);
		const app = createApp(deps({ metrics }));

		await app.request("/health/live");

		expect(await metrics.render()).toContain('route="/health/live"');
	});
});
