import { handleAuthRequest } from "@server/auth/instance";
import { createFileRoute } from "@tanstack/react-router";

// Better Auth owns the wire format under `/api/auth/*`, including WebAuthn
// ceremonies, so these endpoints bypass the generated RPC client. The global
// authentication and CSRF middleware apply only to server functions; Better
// Auth performs its own origin check against `trustedOrigins`.
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleAuthRequest(request),
			POST: ({ request }) => handleAuthRequest(request),
		},
	},
});
