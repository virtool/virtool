import { describe, expect, it, vi } from "vitest";

vi.mock("../../config", () => ({
	config: { metricsToken: "unused", postgresPoolMax: 10 },
}));

const { metricsMiddleware } = await import("../middleware");
const { renderMetrics } = await import("../registry");

type ServerFn = (options: {
	request: Request;
	pathname: string;
	handlerType: string;
	serverFnMeta?: { name: string };
	context: Record<string, unknown>;
	next: () => Promise<{ response: Response }>;
}) => Promise<unknown>;

// `createMiddleware().server(fn)` parks the handler on `options.server`, which
// is exactly where `createStartHandler` reads it from to build the chain.
// `createServerOnlyFn` is the identity function at runtime — only the Vite
// plugin strips it, client-side, at build time — so the body runs unmodified
// under Vitest with no need to mock it away.
const run = metricsMiddleware.options.server as unknown as ServerFn;

function call(
	overrides: {
		method?: string;
		handlerType?: string;
		serverFnMeta?: { name: string };
		next?: () => Promise<{ response: Response }>;
	} = {},
): Promise<unknown> {
	return run({
		request: new Request("http://virtool.test/samples", {
			method: overrides.method ?? "GET",
		}),
		pathname: "/samples",
		handlerType: overrides.handlerType ?? "router",
		serverFnMeta: overrides.serverFnMeta,
		context: {},
		next:
			overrides.next ??
			(async () => ({ response: new Response(null, { status: 200 }) })),
	});
}

describe("metricsMiddleware", () => {
	it("counts a router request by method and response status", async () => {
		await call({
			method: "GET",
			next: async () => ({ response: new Response(null, { status: 204 }) }),
		});

		expect(await renderMetrics()).toContain(
			'virtool_http_requests_total{handler_type="router",method="GET",status="204",server_fn=""} 1',
		);
	});

	it("labels a server function request with its export name", async () => {
		await call({
			method: "POST",
			handlerType: "serverFn",
			serverFnMeta: { name: "getSampleFn" },
		});

		expect(await renderMetrics()).toContain(
			'virtool_http_requests_total{handler_type="serverFn",method="POST",status="200",server_fn="getSampleFn"} 1',
		);
	});

	it("observes request duration in the histogram", async () => {
		await call();

		const body = await renderMetrics();

		expect(body).toContain("virtool_http_request_duration_seconds_bucket");
		expect(body).toContain(
			'virtool_http_request_duration_seconds_count{handler_type="router",method="GET",server_fn=""}',
		);
	});

	// h3's `toResponse` — outside this middleware's visibility — wraps an
	// escaping `Error` as an `HTTPError` and answers 500 by default, so that is
	// what the caller actually receives.
	it("records an Error that escaped the handler as a 500, and rethrows it", async () => {
		const boom = new Error("boom");

		await expect(
			call({
				method: "DELETE",
				next: () => Promise.reject(boom),
			}),
		).rejects.toBe(boom);

		expect(await renderMetrics()).toContain(
			'virtool_http_requests_total{handler_type="router",method="DELETE",status="500",server_fn=""} 1',
		);
	});

	// h3 treats a non-`Error` throw as a response *body* rather than an error,
	// so no status this middleware could report would be accurate — the
	// `"error"` sentinel is reserved for exactly this case.
	it("records a non-Error throw under the error sentinel, and rethrows it", async () => {
		await expect(
			call({
				method: "DELETE",
				next: () => Promise.reject("boom"),
			}),
		).rejects.toBe("boom");

		expect(await renderMetrics()).toContain(
			'virtool_http_requests_total{handler_type="router",method="DELETE",status="error",server_fn=""} 1',
		);
	});

	it("passes the downstream result through untouched", async () => {
		const response = new Response("body", { status: 201 });

		const result = (await call({ next: async () => ({ response }) })) as {
			response: Response;
		};

		expect(result.response).toBe(response);
	});
});
