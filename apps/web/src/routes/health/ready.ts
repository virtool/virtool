import { handleReady } from "@server/health/ready";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health/ready")({
	server: {
		handlers: {
			GET: handleReady,
		},
	},
});
