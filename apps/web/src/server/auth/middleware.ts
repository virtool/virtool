import * as Sentry from "@sentry/tanstackstart-react";
import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import {
	type AdministratorRoleName,
	FORBIDDEN_ERROR_NAME,
	hasSufficientAdminRole,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { users } from "@virtool/data/db/schema/users";
import { eq } from "drizzle-orm";
import { db } from "../composition";
import {
	type AuthenticatedSession,
	parseBasicAuthHeader,
	verifyApiKey,
	verifyRequest,
} from "./verify";

/** Thrown by the auth middleware when a request has no valid session. */
export class UnauthorizedError extends Error {
	constructor() {
		super("Unauthorized");
		this.name = UNAUTHORIZED_ERROR_NAME;
	}
}

/** Thrown when the session user lacks the required administrator role. */
export class ForbiddenError extends Error {
	constructor() {
		super("Forbidden");
		this.name = FORBIDDEN_ERROR_NAME;
	}
}

/**
 * Throw `ForbiddenError` (and 403) if the session user lacks the required
 * administrator role. Reads the user's `administrator_role` from the upstream
 * users table; users with a null role are always rejected.
 */
export const requireAdminRole = createServerOnlyFn(
	async (
		session: AuthenticatedSession,
		requiredRole: AdministratorRoleName,
	): Promise<void> => {
		const [row] = await db
			.select({ administratorRole: users.administratorRole })
			.from(users)
			.where(eq(users.id, session.userId))
			.limit(1);

		if (
			!row ||
			row.administratorRole === null ||
			!hasSufficientAdminRole(requiredRole, row.administratorRole)
		) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}
	},
);

/**
 * Resolve the session for the active server-function request or reject with
 * 401. Sets the HTTP response status as a side effect so the serialized error
 * reaches the client as a real 401.
 */
// createServerOnlyFn keeps the getRequest / db / verifyRequest references
// behind a server boundary so import-protection doesn't pin
// @tanstack/react-start/server in the client graph via start.ts.
export const requireSession = createServerOnlyFn(
	async (): Promise<AuthenticatedSession> => {
		const session = await verifyRequest(db, getRequest());
		if (!session) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}
		return session;
	},
);

/**
 * Resolve the identity behind a raw `Request` (used by `createFileRoute`
 * handlers outside the server-function async-local context). Returns a 401
 * `Response` on failure so the caller can `return` it directly.
 *
 * Either credential works: an HTTP Basic `Authorization` header carrying a user
 * handle and API key, or the session cookie pair. Raw routes are the only
 * endpoints a script can reach without the generated RPC client, so they are
 * where key authentication has to live; server functions stay cookie-only.
 *
 * An `Authorization` header commits the request to the key path — a malformed
 * one is a 401 rather than a silent fall back to whatever cookies happen to be
 * attached. Python's `authentication_middleware` branches the same way.
 */
export const requireAuthenticatedRequest = createServerOnlyFn(
	async (request: Request): Promise<AuthenticatedSession | Response> => {
		const header = request.headers.get("authorization");

		let session: AuthenticatedSession | null;

		if (header) {
			const credentials = parseBasicAuthHeader(header);
			session = credentials
				? await verifyApiKey(db, credentials.handle, credentials.key)
				: null;
		} else {
			session = await verifyRequest(db, request);
		}

		if (!session) {
			return new Response("Unauthorized", { status: 401 });
		}
		return session;
	},
);

/** Resolves the server functions exempt from global authentication. */
export type LoadAuthenticationExceptions = () => Promise<
	ReadonlyArray<{ url: string }>
>;

// A server function's `url` is the server-fn base with its id appended, and an
// id is base64url, so the last segment is the id `serverFnMeta` carries.
// `middleware.test.ts` pins that against the metadata Start actually hands the
// middleware.
export function serverFnIdFromUrl(url: string): string {
	return url.slice(url.lastIndexOf("/") + 1);
}

// The exception list holds server-function references, and reaching them means
// reaching their modules — which carry zod validators and the auth request
// layer. `start.ts` is part of the browser program (routeTree.gen.ts imports
// it), so importing the list eagerly would drag all of that into the eager
// client bundle. createServerOnlyFn strips this body client-side, so the import
// never appears in the browser graph at all.
const loadAuthenticationExceptions = createServerOnlyFn(
	async (): Promise<ReadonlyArray<{ url: string }>> => {
		const { authenticationExceptions } = await import("./exceptions");
		return authenticationExceptions;
	},
);

/**
 * Build the global server-function middleware that enforces authentication on
 * every server function except those in `./exceptions`. Resolved sessions are
 * exposed to downstream handlers as `context.session`.
 *
 * `loadExceptions` exists so tests can supply their own list; production passes
 * nothing and gets the real one.
 */
// Never identify the call from `getRequest()`. That is the *incoming* request,
// which is the function's own URL only for an RPC call from the browser: during
// SSR a server function is invoked in-process, so the incoming request is the
// page being rendered and no exception matches. `serverFnMeta` names the
// function on both paths.
export function createAuthenticationMiddleware(
	loadExceptions: LoadAuthenticationExceptions = loadAuthenticationExceptions,
) {
	// Resolved on the first call and cached: the ids never change.
	let exceptionIds: Set<string> | null = null;

	return createMiddleware({ type: "function" }).server(
		async ({ next, serverFnMeta }) => {
			exceptionIds ??= new Set(
				(await loadExceptions()).map((fn) => serverFnIdFromUrl(fn.url)),
			);

			const session: AuthenticatedSession | null = exceptionIds.has(
				serverFnMeta.id,
			)
				? null
				: await requireSession();
			// Attach the user to the request's isolation scope so errors and logs
			// from this handler are tied to the acting user. Id-only here — the
			// handle isn't on the session and isn't worth a per-request lookup.
			if (session) {
				Sentry.setUser({ id: session.userId });
			}
			return next({ context: { session } });
		},
	);
}
