/** The request fields that decide whether a request needs a CSRF check. */
export type CsrfCandidate = {
	request: Request;
	pathname: string;
	handlerType: "serverFn" | "router";
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Better Auth adds the `__Secure-` prefix in production.
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/;

function isApiKeyOnly(headers: Headers): boolean {
	return (
		headers.has("authorization") &&
		!SESSION_COOKIE.test(headers.get("cookie") ?? "")
	);
}

/**
 * Whether the CSRF middleware should check a request.
 *
 * Server functions are always checked. Any other mutating request is checked
 * when it can authenticate with the session cookie that a browser attaches to
 * same-site forged requests. An `Authorization` header does not exclude that:
 * a browser also attaches cached reverse-proxy Basic credentials, and a raw
 * route falls back to the cookie when they are not an API key. A script that
 * sends an API key sends no `Origin` and must not be blocked, so only a request
 * with the header and no session cookie is skipped.
 *
 * Only `/api/auth/*` is exempt, because Better Auth does its own origin check.
 * The rule names the exemption rather than the protected routes: `pathname` is
 * the raw request path, so a case or encoding variant that still routes to a
 * handler would slip past a prefix match on the protected side.
 */
export function isCsrfCandidate({
	request,
	pathname,
	handlerType,
}: CsrfCandidate): boolean {
	if (handlerType === "serverFn") {
		return true;
	}
	return (
		!SAFE_METHODS.has(request.method) &&
		!isApiKeyOnly(request.headers) &&
		!pathname.startsWith("/api/auth/")
	);
}
