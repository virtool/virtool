import { createServerOnlyFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";

/**
 * The opaque identifier of a session. It is set on a
 * successful login and on a successful reset, and is present *alone* during
 * a forced-reset flow, where it names a session of type `reset`. A reset
 * session is not authenticated as far as the middleware is concerned: a
 * client holding only this cookie gets a 401 from any non-exception server
 * function.
 */
export const SESSION_ID_COOKIE = "session_id";

/**
 * Proves the paired `session_id` belongs to an authenticated session. It is
 * only set on the authenticated branch of login and after a successful
 * reset. Only its hash is stored, so the client is the only holder of the
 * value — treat it as equivalent to the user's password for as long as it is
 * valid.
 */
export const SESSION_TOKEN_COOKIE = "session_token";

/**
 * The `max_age` set on both cookies, regardless of the row's actual
 * `expires_at`. The browser keeps the cookie alive for ~30 days; the DB
 * row's `expires_at` is the real authority.
 */
const MAX_AGE_SECONDS = 2_600_000;

type Bool = boolean;

function cookieOptions(secure: Bool) {
	return {
		httpOnly: true,
		secure,
		sameSite: "lax" as const,
		path: "/",
		maxAge: MAX_AGE_SECONDS,
	};
}

function isSecure(): boolean {
	return process.env.NODE_ENV === "production";
}

/** Read/write/clear access to the pair of session cookies. */
export type CookieAdapter = {
	getSessionId(): string | undefined;
	getSessionToken(): string | undefined;
	setSessionId(sessionId: string): void;
	setSessionToken(token: string): void;
	clear(): void;
};

/* Each method is wrapped in createServerOnlyFn so the references to
   getCookie/setCookie/deleteCookie sit behind a server boundary the compiler
   recognizes — otherwise the object literal at module scope would pin
   @tanstack/react-start/server in any client-reachable import chain. */
export const realCookies: CookieAdapter = {
	getSessionId: createServerOnlyFn(() => getCookie(SESSION_ID_COOKIE)),
	getSessionToken: createServerOnlyFn(() => getCookie(SESSION_TOKEN_COOKIE)),
	setSessionId: createServerOnlyFn((sessionId: string) => {
		setCookie(SESSION_ID_COOKIE, sessionId, cookieOptions(isSecure()));
	}),
	setSessionToken: createServerOnlyFn((token: string) => {
		setCookie(SESSION_TOKEN_COOKIE, token, cookieOptions(isSecure()));
	}),
	clear: createServerOnlyFn(() => {
		deleteCookie(SESSION_ID_COOKIE, { path: "/" });
		deleteCookie(SESSION_TOKEN_COOKIE, { path: "/" });
	}),
};
