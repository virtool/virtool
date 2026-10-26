/** The request fields that decide whether a request needs a CSRF check. */
export type CsrfCandidate = {
	request: Request;
	pathname: string;
	handlerType: "serverFn" | "router";
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether the CSRF middleware should check a request.
 *
 * Server functions are always checked. Any other mutating request is checked
 * when it has no `Authorization` header, because it then authenticates with the
 * session cookie that a browser attaches to same-site forged requests. A script
 * that sends an API key sends no `Origin` and must not be blocked.
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
		!request.headers.has("authorization") &&
		!pathname.startsWith("/api/auth/")
	);
}
