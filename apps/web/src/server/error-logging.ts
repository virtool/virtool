import { createMiddleware } from "@tanstack/react-start";
import { getRequest, getResponseStatus } from "@tanstack/react-start/server";
import {
	FORBIDDEN_ERROR_NAME,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SESSION_NOT_FRESH_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { logger } from "./logger";

const FORBIDDEN_ERROR_NAMES = new Set([
	FORBIDDEN_ERROR_NAME,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SESSION_NOT_FRESH_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
]);

function isExpectedAuthenticationError(err: unknown, status: number): boolean {
	return (
		err instanceof Error &&
		((status === 401 && err.name === UNAUTHORIZED_ERROR_NAME) ||
			(status === 403 && FORBIDDEN_ERROR_NAMES.has(err.name)))
	);
}

/**
 * Global server-function middleware that logs every error a server function
 * raises before it propagates to the client.
 *
 * The client only ever sees a serialized `message`, so the underlying cause of
 * an unexpected failure — most often a Drizzle `DrizzleQueryError` whose real
 * Postgres error lives on `.cause` — is otherwise lost. Logging here, at the one
 * chokepoint every server function passes through, guarantees that cause is
 * recorded regardless of how each feature maps its own domain errors.
 *
 * Intentional client errors set a 4xx status before throwing (see each
 * feature's `rethrowAsHttp`); those are logged at debug. Expected
 * authentication and authorization rejections omit the error object so routine
 * 401/403 responses do not emit stacks or credential-bearing details. Anything
 * else is unexpected and logged at error with its full `cause` chain.
 */
export const errorLoggingMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next, serverFnMeta }) => {
	try {
		return await next();
	} catch (err) {
		const status = getResponseStatus();
		// `path` is the incoming request, which during SSR is the page being
		// rendered rather than the function's own URL. `serverFn` is what names the
		// failing handler on both paths.
		const path = new URL(getRequest().url).pathname;
		const serverFn = serverFnMeta.name;

		if (isExpectedAuthenticationError(err, status)) {
			logger.debug(
				{
					errorName: err instanceof Error ? err.name : undefined,
					path,
					serverFn,
					status,
				},
				"server function rejected request",
			);
		} else if (status >= 400 && status < 500) {
			logger.debug(
				{ err, path, serverFn, status },
				"server function rejected request",
			);
		} else {
			logger.error(
				{ err, path, serverFn, status },
				"unhandled server function error",
			);
		}

		throw err;
	}
});
