import { serverErrorSerializationAdapter } from "@app/serverErrors";
import {
	sentryGlobalFunctionMiddleware,
	sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createAuthenticationMiddleware } from "@server/auth/middleware";
import { errorLoggingMiddleware } from "@server/error-logging";
import { metricsMiddleware } from "@server/metrics/middleware";
import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";

const authenticationMiddleware = createAuthenticationMiddleware();

const cspDirectives = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"font-src 'self'",
	"img-src 'self' data:",
	// No third-party Sentry host is allow-listed: browser envelopes are tunnelled
	// through the same-origin `/monitoring` route (see `routes/monitoring.ts`).
	"connect-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	// Without this, `script-src` is the fallback and its nonce cannot be carried
	// by a blob URL, so every blob-backed worker is blocked. Vite's HMR client
	// spawns one to poll for the dev server after a dropped socket, and Sentry's
	// replay compression worker is blob-backed too.
	"worker-src 'self' blob:",
];

// Builds one response header for served HTML documents. Each builder receives
// the per-response CSP nonce; those that don't need it ignore the argument.
type DocumentHeader = (nonce: string) => [name: string, value: string];

function buildContentSecurityPolicy(
	nonce: string,
): [name: string, value: string] {
	return [
		"Content-Security-Policy",
		[...cspDirectives, `script-src 'self' 'nonce-${nonce}'`].join("; "),
	];
}

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
// middleware body.
const documentHeaders: DocumentHeader[] = [
	buildContentSecurityPolicy,
	buildDocumentPolicy,
	buildCacheControl,
];

// Per-request CSP nonce. Deliberately uses the Web Crypto and `btoa` globals
// rather than node:crypto/Buffer: this file is reachable from the browser
// program (routeTree.gen.ts imports it) and must type-check without Node types.
// Both globals exist in our Node runtime, so the server middleware is safe.
function generateNonce(): string {
	return btoa(
		String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
	);
}

const documentHeadersMiddleware = createMiddleware().server(
	async ({ next }) => {
		const result = await next();
		const { response } = result;
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) {
			return result;
		}

		const html = await response.text();
		const nonce = generateNonce();
		const body = html.replace(/<script(?=[\s>])/g, `<script nonce="${nonce}"`);
		const headers = new Headers(response.headers);
		for (const build of documentHeaders) {
			const [name, value] = build(nonce);
			headers.set(name, value);
		}
		// `response.text()` already decoded the body, so the length and any
		// encoding headers from the original response no longer describe it.
		// Leaving them would make clients try to decode an already-decoded body.
		headers.delete("content-length");
		headers.delete("content-encoding");
		headers.delete("transfer-encoding");

		return {
			...result,
			response: new Response(body, {
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
	defaultSsr: false,
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
