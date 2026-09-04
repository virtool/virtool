import { createServerOnlyFn } from "@tanstack/react-start";
import {
	type RestrictedSetup,
	SETUP_REQUIRED_ERROR_NAME,
	type SetupPurpose,
} from "@virtool/contracts";
import { verifySetupSession } from "@virtool/data/auth/setup";
import { db } from "../composition";
import { SETUP_SESSION_ID_COOKIE, SETUP_SESSION_TOKEN_COOKIE } from "./cookies";
import { parseCookieHeader } from "./verify";

/**
 * Thrown when a request carries a restricted setup credential and asks for
 * anything outside that credential's one purpose.
 *
 * Distinct from `UnauthorizedError` because the caller is not anonymous:
 * sending them to the login wall would strand them, and retrying would fail
 * the same way. `purpose` is the whole of what it adds — enough for the router
 * to pick the right setup surface, and nothing about tokens, sessions or what
 * the holder may do.
 */
export class SetupRequiredError extends Error {
	declare readonly purpose: SetupPurpose;

	constructor(purpose: SetupPurpose) {
		super("Account setup required");
		this.name = SETUP_REQUIRED_ERROR_NAME;
		Object.defineProperty(this, "purpose", {
			value: purpose,
			enumerable: true,
		});
	}
}

/**
 * Resolve the restricted setup credential behind a raw `Request`, or `null`.
 *
 * **The one authority for what a restricted caller is.** The global
 * authentication middleware calls this, the setup-only policy reads what it
 * produced, and nothing else re-derives it — a second reader would be a second
 * chance to widen it.
 *
 * `null` for every failure, including a missing cookie pair, so the boundary
 * answers one refusal without saying which check failed. `verifySetupSession`
 * re-reads `users.active` on the way, so deactivation revokes a restricted
 * session as immediately as it revokes an ordinary one.
 */
// createServerOnlyFn keeps the db and @virtool/data references behind a server
// boundary, so import protection does not pin them in the client graph through
// the middleware that calls this.
export const resolveRestrictedSetup = createServerOnlyFn(
	async (request: Request): Promise<RestrictedSetup | null> => {
		const cookies = parseCookieHeader(request.headers.get("cookie"));

		return verifySetupSession(
			db,
			cookies[SETUP_SESSION_ID_COOKIE],
			cookies[SETUP_SESSION_TOKEN_COOKIE],
		);
	},
);
