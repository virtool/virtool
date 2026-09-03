import { createServerOnlyFn } from "@tanstack/react-start";
import { db } from "../composition";
import { config } from "../config";
import { createAuth } from "./betterAuth";

/**
 * The Better Auth instance for this process.
 *
 * Kept apart from {@link createAuth} so the factory stays free of the
 * composition root. Importing this module builds the database handle, the
 * event emitter and the rest of the singletons; importing the factory does
 * not, which is what lets its tests run against a throwaway database.
 */
export const auth = createAuth({
	db,
	publicOrigin: config.publicOrigin,
	webauthnRpId: config.webauthnRpId,
	secret: config.authSecret,
});

/**
 * Hand a request to Better Auth.
 *
 * Wrapped in `createServerOnlyFn` so the route module that mounts it can import
 * this without pulling Better Auth, `@virtool/data` and `node:crypto` into the
 * browser graph through the route tree.
 */
export const handleAuthRequest = createServerOnlyFn(
	(request: Request): Promise<Response> => auth.handler(request),
);
