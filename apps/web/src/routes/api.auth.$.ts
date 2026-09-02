import { handleAuthRequest } from "@server/auth/betterAuth";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: Better Auth owns the wire format under
// `/api/auth/*`, and its browser client and the WebAuthn ceremonies call these
// paths directly rather than through the generated RPC client.
//
// It is deliberately absent from `@server/auth/exceptions`, which lists server
// functions exempt from the global authentication middleware. That middleware
// only runs for `createServerFn` calls, so a raw route was never subject to it
// and listing one there would assert an exemption it does not need.
//
// The global CSRF middleware in `start.ts` is likewise scoped to
// `handlerType === "serverFn"` and does not apply here. Better Auth does its own
// origin checking against the configured `trustedOrigins`, so the global policy
// stays exactly as strict as it was.
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleAuthRequest(request),
			POST: ({ request }) => handleAuthRequest(request),
		},
	},
});
