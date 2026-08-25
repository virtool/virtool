import type { AddressInfo } from "node:net";
import { createDb, type PgClient } from "@virtool/data/db/pg";
import { createLogger, type Logger } from "@virtool/logger";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMetrics } from "./metrics/registry";
import { createProbeServer, type ProbeDeps } from "./probes";

const METRICS_TOKEN = "a-metrics-token";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let client: PgClient;
let applicationName: string;

beforeAll(async () => {
	// `VT_POSTGRES_URL` comes from the shared testcontainer named as this
	// project's `globalSetup`. A real pool is what makes the readiness assertions
	// below mean anything: a fake that resolves would pass whether or not the
	// handler ever queries.
	({ client, applicationName } = createDb(
		{ postgresUrl: process.env.VT_POSTGRES_URL as string, postgresPoolMax: 2 },
		"tasks-test",
	));
}, 60_000);

afterAll(async () => {
	await client.end();
});

/**
 * A postgres.js client that cannot reach a database.
 *
 * The real thing is called as a tagged template, so a function rejecting is
 * enough to stand in for an unreachable server.
 */
function unreachableClient(): PgClient {
	return (() =>
		Promise.reject(new Error("ECONNREFUSED"))) as unknown as PgClient;
}

/** Start a probe listener on an ephemeral port and return a `fetch` for it. */
async function serve(overrides: Partial<ProbeDeps> = {}): Promise<{
	get: (path: string, headers?: HeadersInit) => Promise<Response>;
	close: () => Promise<void>;
}> {
	const server = createProbeServer({
		client,
		applicationName,
		logger,
		metrics: createMetrics("1.2.3", 2),
		metricsToken: METRICS_TOKEN,
		isReady: () => true,
		...overrides,
	});

	await new Promise<void>((resolve) => server.listen(0, resolve));

	const { port } = server.address() as AddressInfo;

	return {
		get: (path, headers) =>
			fetch(`http://127.0.0.1:${port}${path}`, { headers }),
		close: () =>
			new Promise<void>((resolve) => {
				server.close(() => resolve());
				server.closeAllConnections();
			}),
	};
}

describe("GET /health/live", () => {
	// The D14 constraint, made executable. A liveness probe that depends on
	// Postgres restarts the whole fleet on a database blip, killing every task in
	// flight to fix nothing.
	it("answers 200 with the database unreachable", async () => {
		const probe = await serve({ client: unreachableClient() });

		try {
			const response = await probe.get("/health/live");

			expect(response.status).toBe(200);
			await expect(response.json()).resolves.toEqual({ status: "alive" });
		} finally {
			await probe.close();
		}
	});

	it("answers 200 while shutting down", async () => {
		const probe = await serve({
			client: unreachableClient(),
			isReady: () => false,
		});

		try {
			expect((await probe.get("/health/live")).status).toBe(200);
		} finally {
			await probe.close();
		}
	});
});

describe("GET /health/ready", () => {
	it("answers 200 when Postgres is up", async () => {
		const probe = await serve();

		try {
			const response = await probe.get("/health/ready");

			expect(response.status).toBe(200);
			await expect(response.json()).resolves.toEqual({
				status: "ready",
				checks: { postgres: { ok: true } },
			});
		} finally {
			await probe.close();
		}
	});

	it("answers 503 when Postgres is unreachable", async () => {
		const probe = await serve({ client: unreachableClient() });

		try {
			const response = await probe.get("/health/ready");

			expect(response.status).toBe(503);
			await expect(response.json()).resolves.toMatchObject({
				status: "unavailable",
			});
		} finally {
			await probe.close();
		}
	});

	// The listener stays up through shutdown precisely so the kubelet gets this
	// answer rather than a connection refused.
	it("answers 503 once shutdown has begun, without querying", async () => {
		const probe = await serve({
			client: (() => {
				throw new Error("a draining process must not query the database");
			}) as unknown as PgClient,
			isReady: () => false,
		});

		try {
			expect((await probe.get("/health/ready")).status).toBe(503);
		} finally {
			await probe.close();
		}
	});
});

describe("GET /metrics", () => {
	// Withholding even the fact that the endpoint exists, so an existing
	// deployment does not start exposing internals on upgrade.
	it("answers 404 when no token is configured", async () => {
		const probe = await serve({ metricsToken: undefined });

		try {
			const response = await probe.get("/metrics", {
				authorization: `Bearer ${METRICS_TOKEN}`,
			});

			expect(response.status).toBe(404);
		} finally {
			await probe.close();
		}
	});

	it("answers 401 with no credential", async () => {
		const probe = await serve();

		try {
			expect((await probe.get("/metrics")).status).toBe(401);
		} finally {
			await probe.close();
		}
	});

	// A *different length* on purpose: `timingSafeEqual` throws rather than
	// returning false when the buffers differ in size, so the shared helper
	// screens the length first. A 500 here means that screen was lost.
	it("answers 401 to a token of a different length", async () => {
		const probe = await serve();

		try {
			const response = await probe.get("/metrics", {
				authorization: "Bearer short",
			});

			expect(response.status).toBe(401);
		} finally {
			await probe.close();
		}
	});

	it("answers 401 to a same-length token that differs", async () => {
		const probe = await serve();

		try {
			const wrong = `${"b".repeat(METRICS_TOKEN.length - 1)}c`;
			const response = await probe.get("/metrics", {
				authorization: `Bearer ${wrong}`,
			});

			expect(response.status).toBe(401);
		} finally {
			await probe.close();
		}
	});

	it("answers 401 to a malformed authorization header", async () => {
		const probe = await serve();

		try {
			const response = await probe.get("/metrics", {
				authorization: METRICS_TOKEN,
			});

			expect(response.status).toBe(401);
		} finally {
			await probe.close();
		}
	});

	it("renders the registry with the right token", async () => {
		const probe = await serve();

		try {
			const response = await probe.get("/metrics", {
				authorization: `Bearer ${METRICS_TOKEN}`,
			});

			expect(response.status).toBe(200);

			const body = await response.text();

			// Left unprefixed on purpose, so off-the-shelf Node dashboards match.
			expect(body).toContain("process_cpu_seconds_total");
			expect(body).toContain("virtool_postgres_pool_max 2");
		} finally {
			await probe.close();
		}
	});

	// The task runner's claim and heartbeat loops make its pool just as worth
	// watching as the web app's or the jobs API's — read the same way, filtered
	// on this process's own `application_name`.
	it("reports this process's own connection as active", async () => {
		const probe = await serve();

		try {
			const body = await (
				await probe.get("/metrics", {
					authorization: `Bearer ${METRICS_TOKEN}`,
				})
			).text();

			expect(body).toContain('virtool_postgres_connections{state="active"} 1');
		} finally {
			await probe.close();
		}
	});

	// A Postgres outage is exactly when the rest of these metrics matter most, so
	// a failed pool read drops only the gauges it feeds rather than the whole
	// scrape.
	it("still renders when the pool read fails", async () => {
		const probe = await serve({ client: unreachableClient() });

		try {
			const response = await probe.get("/metrics", {
				authorization: `Bearer ${METRICS_TOKEN}`,
			});
			const body = await response.text();

			expect(response.status).toBe(200);
			expect(body).toContain("process_cpu_seconds_total");
			expect(body).not.toContain("virtool_postgres_connections{");
		} finally {
			await probe.close();
		}
	});

	// The `__APP_VERSION__` trap: that global is a Vite `define` and does not
	// exist in a bundled Node app, so a version read from ambient scope renders
	// as an empty label with nothing failing to say so.
	it("renders virtool_app_info with a non-empty version", async () => {
		const probe = await serve();

		try {
			const body = await (
				await probe.get("/metrics", {
					authorization: `Bearer ${METRICS_TOKEN}`,
				})
			).text();

			const line = body
				.split("\n")
				.find((candidate) => candidate.startsWith("virtool_app_info{"));

			expect(line).toBeDefined();

			const version = /version="([^"]*)"/.exec(line as string)?.[1];

			expect(version).toBe("1.2.3");
			expect(version).not.toBe("");
			expect(version).not.toBe("undefined");
		} finally {
			await probe.close();
		}
	});
});

describe("GET /metrics queue gauges", () => {
	async function scrape(overrides: Partial<ProbeDeps>): Promise<string> {
		const probe = await serve(overrides);

		try {
			return await (
				await probe.get("/metrics", {
					authorization: `Bearer ${METRICS_TOKEN}`,
				})
			).text();
		} finally {
			await probe.close();
		}
	}

	it("refreshes the queue gauges from the reader", async () => {
		const body = await scrape({
			readTaskQueue: async () => ({
				counts: [{ type: "install_hmms", queued: 4, running: 1 }],
				oldestQueuedAges: [{ type: "install_hmms", ageSeconds: 120 }],
			}),
		});

		expect(body).toContain(
			'virtool_tasks{type="install_hmms",state="queued"} 4',
		);
		expect(body).toContain(
			'virtool_tasks_oldest_queued_age_seconds{type="install_hmms"} 120',
		);
	});

	// The queue gauges are the spawner half's. Every replica carries a runner, so
	// a reader wired unconditionally would have N replicas each scanning the same
	// table on every scrape to publish N copies of one number.
	it("emits no queue series when spawning is disabled", async () => {
		const body = await scrape({ readTaskQueue: undefined });

		expect(body).not.toContain("virtool_tasks{");
		expect(body).not.toContain("virtool_tasks_oldest_queued_age_seconds{");
		expect(body).toContain("process_cpu_seconds_total");
	});

	// A Postgres outage is when the rest of these metrics matter most, so a
	// failed read drops only the gauges it feeds. They are dropped rather than
	// left stale: re-serving the last depth would have Prometheus record it as
	// fresh on every scrape of the outage.
	it("drops the queue series and still answers 200 when the read fails", async () => {
		const body = await scrape({
			readTaskQueue: () => Promise.reject(new Error("postgres is down")),
		});

		expect(body).not.toContain("virtool_tasks{");
		expect(body).toContain("virtool_app_info{");
	});
});

describe("anything else", () => {
	it("answers 404", async () => {
		const probe = await serve();

		try {
			expect((await probe.get("/")).status).toBe(404);
			expect((await probe.get("/health")).status).toBe(404);
		} finally {
			await probe.close();
		}
	});
});
