import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Best-effort client IP for the session row, from the proxy headers Python
 * reads in `virtool/api/authentication.py:get_ip`. Falls back to the empty
 * string, which the column allows.
 *
 * Wrapped in createServerOnlyFn so the compiler strips this body and its
 * getRequest import from the client bundle. A plain top-level helper would keep
 * @tanstack/react-start/server in the client module graph.
 */
export const getClientIp: () => string = createServerOnlyFn((): string => {
	const request = getRequest();
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		""
	);
});
