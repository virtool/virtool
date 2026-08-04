import type { ConnectionCounts } from "@virtool/data/metrics/data";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { configMock, readConnectionCounts } = vi.hoisted(() => ({
	configMock: {
		metricsToken: undefined as string | undefined,
		postgresPoolMax: 10,
	},
	readConnectionCounts: vi.fn(),
}));

vi.mock("../../config", () => ({ config: configMock }));
vi.mock("../../composition", () => ({
	client: {},
	applicationName: "virtool-ts@test",
}));
vi.mock("@virtool/data/metrics/data", () => ({ readConnectionCounts }));
vi.mock("../../logger", () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { handleMetrics } = await import("../handler");

const TOKEN = "s3cret-scrape-token";

const COUNTS: ConnectionCounts = {
	active: 3,
	idle: 4,
	idleInTransaction: 1,
	other: 0,
};

function scrape(headers: Record<string, string> = {}): Promise<Response> {
	return handleMetrics(new Request("http://virtool.test/metrics", { headers }));
}

beforeEach(() => {
	configMock.metricsToken = TOKEN;
	readConnectionCounts.mockReset().mockResolvedValue(COUNTS);
});

describe("handleMetrics", () => {
	it("reports 404 when no token is configured", async () => {
		configMock.metricsToken = undefined;

		const response = await scrape({ authorization: `Bearer ${TOKEN}` });

		expect(response.status).toBe(404);
		// The endpoint must not do any work before refusing.
		expect(readConnectionCounts).not.toHaveBeenCalled();
	});

	it("rejects a request carrying no credentials", async () => {
		const response = await scrape();

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Bearer");
		expect(readConnectionCounts).not.toHaveBeenCalled();
	});

	it.each([
		["a wrong token of the same length", `Bearer ${"x".repeat(TOKEN.length)}`],
		["a wrong token of a different length", "Bearer short"],
		["a token with no Bearer scheme", TOKEN],
		["Basic credentials", "Basic dXNlcjpwYXNz"],
		["a token padded with whitespace", `Bearer  ${TOKEN}`],
	])("rejects %s", async (_label, authorization) => {
		const response = await scrape({ authorization });

		expect(response.status).toBe(401);
		expect(readConnectionCounts).not.toHaveBeenCalled();
	});

	// RFC 9110 §11.1: the auth scheme is case-insensitive.
	it.each(["Bearer", "bearer", "BEARER", "BeArEr"])(
		"accepts the %s scheme",
		async (scheme) => {
			const response = await scrape({
				authorization: `${scheme} ${TOKEN}`,
			});

			expect(response.status).toBe(200);
		},
	);

	it("serves the registry to a correctly authenticated scrape", async () => {
		const response = await scrape({ authorization: `Bearer ${TOKEN}` });

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");

		const body = await response.text();

		expect(body).toContain(`virtool_app_info{version="${__APP_VERSION__}"} 1`);
		expect(body).toContain("virtool_postgres_pool_max 10");
		expect(body).toContain('virtool_postgres_connections{state="active"} 3');
		expect(body).toContain('virtool_postgres_connections{state="idle"} 4');
		expect(body).toContain(
			'virtool_postgres_connections{state="idle in transaction"} 1',
		);
		// Standard names from collectDefaultMetrics, left unprefixed so
		// off-the-shelf Node dashboards match them.
		expect(body).toContain("process_resident_memory_bytes");
		expect(body).toContain("nodejs_eventloop_lag_seconds");
	});

	it("still serves process metrics when Postgres is unreachable", async () => {
		readConnectionCounts.mockRejectedValue(new Error("connection refused"));

		const response = await scrape({ authorization: `Bearer ${TOKEN}` });

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("process_resident_memory_bytes");
	});

	// A saturated pool queues the probe client-side, where nothing rejects, so
	// the scrape has to abandon it rather than hang past Prometheus' deadline.
	it("still serves process metrics when the pool probe never settles", async () => {
		readConnectionCounts.mockReturnValue(new Promise(() => {}));

		vi.useFakeTimers();

		const pending = scrape({ authorization: `Bearer ${TOKEN}` });

		await vi.advanceTimersByTimeAsync(5000);
		vi.useRealTimers();

		const response = await pending;

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("process_resident_memory_bytes");
	});
});
