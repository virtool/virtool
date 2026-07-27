import { handleMetrics } from "@server/metrics/handler";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: Prometheus scrapes it over plain HTTP and
// cannot use the generated RPC client. See `@server/metrics/handler` for why the
// authorization floor lives in the handler.
export const Route = createFileRoute("/metrics")({
	server: {
		handlers: {
			GET: ({ request }) => handleMetrics(request),
		},
	},
});
