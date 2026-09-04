import * as Sentry from "@sentry/tanstackstart-react";
import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import {
	type AdministratorRoleName,
	FORBIDDEN_ERROR_NAME,
	hasSufficientAdminRole,
	type RestrictedSetup,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { users } from "@virtool/data/db/schema/users";
import { eq } from "drizzle-orm";
import { db } from "../composition";
import { resolveRestrictedSetup, SetupRequiredError } from "./restricted";
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
 *
 * A policy states the floor a call has to clear before the handler runs. This is
 * for the rule that cannot be stated at the door because it depends on the row
 * being touched — an administrator editing another administrator needs the
 * `full` role, and that is only knowable after the target user is read.
 * `updateUserFn` is the worked example. A role check never belongs in `data.ts`,
 * which is in `@virtool/data` and has no notion of a session at all.
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
 *
 * Handlers do **not** call this. They read `context.session`, which their policy
 * put there; calling this in a handler buys a second Postgres lookup for a
 * session that has already been resolved.
 *
 * A restricted setup credential resolves to nothing here, because it is not an
 * application session: `verifyRequest` reads only the authenticated cookie
 * pair, and a restricted holder carries neither half of it. That is what makes
 * every ordinary policy refuse a restricted caller without knowing the concept
 * exists.
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

// The non-throwing half of `requireSession`, for the global middleware, which
// has a second credential to consider before it can answer 401.
const resolveSessionOrNull = createServerOnlyFn(
	async (): Promise<AuthenticatedSession | null> =>
		verifyRequest(db, getRequest()),
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
 * attached. A restricted setup credential in the cookies does not change that
 * and never could: neither branch here reads the setup cookies, so a
 * restricted holder gets the same 401 an anonymous caller gets from SSE,
 * uploads, downloads and every streamed file. `middleware.test.ts` pins it,
 * because "it happens not to look" is only a guarantee while nobody adds a
 * third branch.
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
 * What the global middleware hands downstream: exactly one resolved credential,
 * or neither for a function exempt from authentication.
 *
 * Both fields are always present, so a policy reads the one it cares about
 * without having to know which branch produced the context.
 */
export type AuthContext = {
	session: AuthenticatedSession | null;
	restricted: RestrictedSetup | null;
};

/** Resolves the server functions a restricted setup principal may call. */
export type LoadSetupEndpoints = () => Promise<
	ReadonlyArray<{ fn: { url: string } }>
>;

// Loaded the same way, and lazily for the same reason, as the authentication
// exceptions above.
const loadSetupEndpoints = createServerOnlyFn(
	async (): Promise<ReadonlyArray<{ fn: { url: string } }>> => {
		const { setupEndpoints } = await import("./setupExceptions");
		return setupEndpoints;
	},
);

/**
 * Build the global server-function middleware that enforces authentication on
 * every server function except those in `./exceptions`. Resolved sessions are
 * exposed to downstream handlers as `context.session`.
 *
 * Authentication is enforced here rather than by a `requireSession()` call in
 * each handler, because forgetting that call is silent — the function would
 * simply be publicly callable. Default-on with an explicit opt-out flips the
 * failure mode: forgetting to list a function in `./exceptions` produces a 401
 * the moment it is called, not a hole.
 *
 * This answers *who is calling*, never *what they may do*. That second question
 * belongs to a policy declared on the function itself (`./policy`).
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
	loadSetup: LoadSetupEndpoints = loadSetupEndpoints,
) {
	// Resolved on the first call and cached: the ids never change.
	let exceptionIds: Set<string> | null = null;
	let setupIds: Set<string> | null = null;

	return createMiddleware({ type: "function" }).server(
		async ({ next, serverFnMeta }) => {
			exceptionIds ??= new Set(
				(await loadExceptions()).map((fn) => serverFnIdFromUrl(fn.url)),
			);
			setupIds ??= new Set(
				(await loadSetup()).map(({ fn }) => serverFnIdFromUrl(fn.url)),
			);

			const context: AuthContext = exceptionIds.has(serverFnMeta.id)
				? { session: null, restricted: null }
				: await resolvePrincipal(setupIds, serverFnMeta.id);

			return next({ context });
		},
	);
}

/**
 * Resolve the one credential a request carries, or refuse it.
 *
 * The order is the whole of the setup restriction. An application session
 * wins outright — a holder of both is an ordinary user with a stale setup
 * cookie left over, and the session is what describes them. Only then is the
 * restricted credential considered, and a restricted caller is refused
 * anything outside the allowlist *here*, before the function's own
 * `authenticated()`, `adminRole()` or `permission()` policy gets a chance to
 * resolve them as an ordinary user.
 *
 * The refusal is a 403 carrying the purpose rather than a 401, because the
 * caller has a credential — it just does not reach this. That is what tells
 * the router which setup surface they belong on, and it says nothing about
 * tokens, sessions or what the holder may do.
 */
const resolvePrincipal = createServerOnlyFn(
	async (setupIds: Set<string>, serverFnId: string): Promise<AuthContext> => {
		const session = await resolveSessionOrNull();

		if (session) {
			// Attach the user to the request's isolation scope so errors and logs
			// from this handler are tied to the acting user. Id-only here — the
			// handle isn't on the session and isn't worth a per-request lookup.
			Sentry.setUser({ id: session.userId });
			return { session, restricted: null };
		}

		const restricted = await resolveRestrictedSetup(getRequest());

		if (!restricted) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}

		// The user id, and nothing else. A restricted principal has no role to
		// attribute and its secret half must not reach a log.
		Sentry.setUser({ id: restricted.userId });

		if (!setupIds.has(serverFnId)) {
			setResponseStatus(403);
			throw new SetupRequiredError(restricted.purpose);
		}

		return { session: null, restricted };
	},
);
