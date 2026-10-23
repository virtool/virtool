import { isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

/**
 * Global request middleware that keeps the status of a page redirect.
 *
 * During server rendering, a route guard calls server functions in-process, on
 * the page request itself. A rejected session makes the authentication
 * middleware set 401 or 403 on that request. Start applies the stored status to
 * the redirect the guard then throws, so the browser gets an empty 401 instead
 * of a redirect to the login wall. Setting the redirect's own status replaces
 * the stored one.
 */
export const redirectStatusMiddleware = createMiddleware().server(
	async ({ handlerType, next }) => {
		const result = await next();

		if (handlerType === "router" && isRedirect(result.response)) {
			setResponseStatus(result.response.status);
		}

		return result;
	},
);
