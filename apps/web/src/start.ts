import { serverErrorSerializationAdapter } from "@app/serverErrors";
import {
	sentryGlobalFunctionMiddleware,
	sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createAuthenticationMiddleware } from "@server/auth/middleware";
import { buildContentSecurityPolicy, getRequestNonce } from "@server/csp";
import { errorLoggingMiddleware } from "@server/error-logging";
import { metricsMiddleware } from "@server/metrics/middleware";
import {
	createCsrfMiddleware,
	createMiddleware,
	createServerOnlyFn,
	createStart,
} from "@tanstack/react-start";

const authenticationMiddleware = createAuthenticationMiddleware();

// Builds one response header for served HTML documents. Each builder receives
// the per-response CSP nonce; those that don't need it ignore the argument.
type DocumentHeader = (nonce: string) => [name: string, value: string];

// Opt the document into the JS Self-Profiling API so Sentry's browser profiling
// integration can sample. A no-op in browsers without the API (Firefox, Safari),
// so it is safe to send unconditionally.
function buildDocumentPolicy(): [name: string, value: string] {
	return ["Document-Policy", "js-profiling"];
}

// HTML documents carry a per-request nonce and authenticated state; never let a
// shared cache hold onto them.
function buildCacheControl(): [name: string, value: string] {
	return ["Cache-Control", "no-store"];
}

// Adding a document header is a new entry here, not another edit to the
// middleware body. The CSP header is built separately below because it needs
// the storage origins, which are resolved asynchronously.
const documentHeaders: DocumentHeader[] = [
	buildDocumentPolicy,
	buildCacheControl,
];

// Origins the browser talks to storage on directly: chunked uploads PUT their
// blocks to the presigned URL, whose host is one of these. Resolved once, on
// the first document served, and cached. Behind a server-only dynamic import
// so `@server/config` — which reads `process.env` and `node:fs` when it loads —
// never enters the browser graph.
let cachedStorageConnectSrc: readonly string[] | undefined;

const getStorageConnectSrc = createServerOnlyFn(
	async (): Promise<readonly string[]> => {
		if (cachedStorageConnectSrc !== undefined) {
			return cachedStorageConnectSrc;
		}

		const { config } = await import("@server/config");
		const { storage } = config;

		// The presigned upload origin is `uploadUrl ?? downloadUrl ?? endpoint`,
		// and an Azure account with none of those set falls back to its blob
		// endpoint, so allow-list every host a presigned URL could carry.
		const candidates =
			storage.kind === "azure"
				? [
						storage.uploadUrl,
						storage.downloadUrl,
						storage.endpoint,
						`https://${storage.account}.blob.core.windows.net`,
					]
				: [storage.endpoint];

		const origins = new Set<string>();
		for (const candidate of candidates) {
			if (candidate) {
				origins.add(new URL(candidate).origin);
			}
		}

		cachedStorageConnectSrc = [...origins];
		return cachedStorageConnectSrc;
	},
);

// Headers only — the body streams straight through. Every script in the
// document already carries the nonce, because Router stamps it on from
// `router.options.ssr.nonce` (see `router.tsx`). Rewriting `<script` tags here
// instead would mean reading the body, which buffers the whole stream and gives
// up progressive rendering to re-do what the markup already has.
const documentHeadersMiddleware = createMiddleware().server(
	async ({ next }) => {
		const result = await next();
		const { response } = result;
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) {
			return result;
		}

		const nonce = getRequestNonce();
		const headers = new Headers(response.headers);
		headers.set(
			"Content-Security-Policy",
			buildContentSecurityPolicy(nonce, await getStorageConnectSrc()),
		);
		for (const build of documentHeaders) {
			const [name, value] = build(nonce);
			headers.set(name, value);
		}

		return {
			...result,
			response: new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			}),
		};
	},
);

// Server functions are same-origin RPC endpoints callable from any site.
// Scoping CSRF checks to serverFn requests avoids blocking regular page
// loads and API proxy routes that don't share the same threat model.
const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

// Sentry middleware go first in each list so the request span wraps the
// csrf/header request middleware and the function span wraps the auth function
// middleware, rather than nesting inside them.
export const startInstance = createStart(() => ({
	// Runs before TanStack Router's ShallowErrorPlugin, which would otherwise
	// flatten every server-function Error to its message alone. Keeps the auth
	// errors' `name` intact so the query retry guard can recognize a 401/403,
	// and a ClientError's `status` so a route loader can map a 404 to notFound.
	serializationAdapters: [serverErrorSerializationAdapter],
	// The metrics middleware sits directly inside Sentry's so its timing covers
	// everything the request actually pays for, including the CSRF check and the
	// document-header rewrite below it.
	requestMiddleware: [
		sentryGlobalRequestMiddleware,
		metricsMiddleware,
		csrfMiddleware,
		documentHeadersMiddleware,
	],
	functionMiddleware: [
		sentryGlobalFunctionMiddleware,
		errorLoggingMiddleware,
		authenticationMiddleware,
	],
}));
