import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import type { RequestSample } from "./registry";

// `start.ts` is part of the browser program (routeTree.gen.ts imports it), so a
// static import of the registry would drag prom-client — and the node:os,
// node:process and node:perf_hooks reads behind `collectDefaultMetrics` — into
// the client graph. createServerOnlyFn strips this body client-side, so the
// import never appears there at all. Node's module cache makes every call after
// the first a resolved-promise lookup.
//
// Recording is best-effort: this runs on the path of every request in the
// process, so a broken registry must degrade the metrics rather than the
// service. The failure is logged once — it would otherwise repeat per request,
// and the causes (a label mismatch, a failed import) are all deterministic.
let reportedFailure = false;

const observe = createServerOnlyFn(
	async (sample: RequestSample): Promise<void> => {
		try {
			const { recordHttpRequest } = await import("./registry");
			recordHttpRequest(sample);
		} catch (err) {
			if (!reportedFailure) {
				reportedFailure = true;
				const { logger } = await import("../logger");
				logger.warn({ err }, "could not record request metrics");
			}
		}
	},
);

/**
 * Global request middleware that counts and times every HTTP request, whether
 * it lands on a server function, a raw route, or a rendered page.
 *
 * Duration is measured to the point the `Response` is returned, not to the last
 * byte of the body. For a streaming response — `/events`, an upload — that is
 * time-to-headers, which is what the latency of a long-lived stream should mean.
 *
 * Every label is drawn from a bounded set. In particular the request path is
 * *not* a label: pathnames carry ids and would blow up cardinality. Server
 * functions are identified by their export name instead, which is bounded by the
 * number of functions in the codebase.
 */
export const metricsMiddleware = createMiddleware().server(
	async ({ next, request, handlerType, serverFnMeta }) => {
		const startedAt = performance.now();
		const method = request.method;
		const serverFn = serverFnMeta?.name ?? "";

		function elapsedSeconds(): number {
			return (performance.now() - startedAt) / 1000;
		}

		try {
			const result = await next();

			await observe({
				handlerType,
				method,
				status: String(result.response.status),
				serverFn,
				durationSeconds: elapsedSeconds(),
			});

			return result;
		} catch (err) {
			// An `Error` that escapes the whole request middleware chain still
			// becomes a response: h3's `toResponse`, at the outermost boundary this
			// middleware cannot see, wraps it as an `HTTPError` and answers 500 by
			// default — the only way it would not is a `.status` set on the error
			// itself, which is a server-function-only pattern (`ClientError`) that
			// never reaches this catch, since `handleServerAction` resolves those
			// to a response itself rather than rethrowing. `"error"` is reserved
			// for a non-`Error` throw, which h3 treats as a response *body*
			// instead of an error — no status this middleware could report would
			// be accurate for that case.
			await observe({
				handlerType,
				method,
				status: err instanceof Error ? "500" : "error",
				serverFn,
				durationSeconds: elapsedSeconds(),
			});

			throw err;
		}
	},
);
