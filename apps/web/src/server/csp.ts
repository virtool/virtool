import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const cspDirectives = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"font-src 'self'",
	"img-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	// Without this, `script-src` is the fallback and its nonce cannot be carried
	// by a blob URL, so every blob-backed worker is blocked. Vite's HMR client
	// spawns one to poll for the dev server after a dropped socket, and Sentry's
	// replay compression worker is blob-backed too.
	"worker-src 'self' blob:",
];

// Per-request CSP nonce. Deliberately uses the Web Crypto and `btoa` globals
// rather than node:crypto/Buffer: this module is reached from `router.tsx`,
// which is in the browser program, and must type-check without Node types.
// Both globals exist in our Node runtime, so this is safe on the server.
function generateNonce(): string {
	return btoa(
		String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
	);
}

// Two callers need the same nonce for one request: `getRouter` puts it on
// `router.options.ssr` so Router and React can stamp it onto every script they
// emit, and the document-header middleware names it in `script-src`. Keying the
// cache on the request object rather than a module-level variable is what keeps
// concurrent SSR renders from sharing a nonce; a `WeakMap` drops the entry with
// the request, so nothing accumulates across a process's lifetime.
const nonces = new WeakMap<Request, string>();

/**
 * The CSP nonce for the request being served, generated on first call.
 *
 * Order-independent: whichever of the router or the header middleware asks
 * first mints it, and the other reads back the same value.
 */
export const getRequestNonce: () => string = createServerOnlyFn(() => {
	const request = getRequest();

	const existing = nonces.get(request);
	if (existing !== undefined) {
		return existing;
	}

	const nonce = generateNonce();
	nonces.set(request, nonce);
	return nonce;
});

/**
 * The `Content-Security-Policy` header value for a document carrying `nonce`.
 *
 * `connect-src` allows `'self'` plus every origin in `connectSrc`. Chunked
 * uploads PUT their blocks straight to blob storage from the browser, so the
 * storage origin has to be allow-listed or every block is blocked. No
 * third-party Sentry host is allow-listed: browser envelopes are tunnelled
 * through the same-origin `/monitoring` route (see `routes/monitoring.ts`).
 */
export function buildContentSecurityPolicy(
	nonce: string,
	connectSrc: readonly string[] = [],
): string {
	return [
		...cspDirectives,
		["connect-src 'self'", ...connectSrc].join(" "),
		`script-src 'self' 'nonce-${nonce}'`,
	].join("; ");
}
