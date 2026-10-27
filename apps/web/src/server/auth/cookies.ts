import { createServerOnlyFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	getCookies,
	setCookie,
} from "@tanstack/react-start/server";

/**
 * Cookies of the retired legacy session system. No release after the cutover
 * reads them, so a browser that still holds them has them expired.
 */
const LEGACY_SESSION_COOKIES = ["session_id", "session_token"] as const;

/**
 * The opaque identifier of a restricted setup session. Names the row and
 * nothing more: it is safe to log and to attribute an error to, and proves
 * nothing on its own.
 *
 * Deliberately not `session_id`. A restricted setup credential is not an
 * application session, and sharing the cookie name with one would make the two
 * indistinguishable to every reader — including the ones whose whole job is to
 * tell them apart.
 */
export const SETUP_SESSION_ID_COOKIE = "setup_session_id";

/**
 * Proves the paired `setup_session_id` belongs to a live restricted setup
 * session. Only its hash is stored, so the client is the only holder of the
 * value. It authorizes exactly one setup purpose and reaches nothing else.
 */
export const SETUP_SESSION_TOKEN_COOKIE = "setup_session_token";

/**
 * The `max_age` set on the setup cookies.
 *
 * Deliberately short, unlike the session pair's. A setup credential is
 * finished with the moment its flow is, and a stale one left in the browser
 * would be presented on every later request and refused — which is the state
 * that looks to a user like being stuck. The row's `expires_at` is still the
 * real authority; this only keeps the browser from holding the pair long after
 * it can be of any use.
 */
const SETUP_MAX_AGE_SECONDS = 3_600;

/**
 * The accounts this browser signed in to with a correct password. Each entry
 * gives the browser its own sign-in budget for that account. It is not a
 * credential and authorizes nothing.
 */
const LOGIN_DEVICE_COOKIE = "login_device";

type Bool = boolean;

function cookieOptions(secure: Bool, maxAge: number) {
	return {
		httpOnly: true,
		secure,
		sameSite: "lax" as const,
		path: "/",
		maxAge,
	};
}

function isSecure(): boolean {
	return process.env.NODE_ENV === "production";
}

/** Read the browser's login devices. */
export const getLoginDevices = createServerOnlyFn((): string | undefined =>
	getCookie(LOGIN_DEVICE_COOKIE),
);

/** Store the browser's login devices for their full lifetime. */
export const setLoginDevices = createServerOnlyFn(
	(value: string, maxAgeSeconds: number): void => {
		setCookie(
			LOGIN_DEVICE_COOKIE,
			value,
			cookieOptions(isSecure(), maxAgeSeconds),
		);
	},
);

/**
 * Expire any legacy session cookie the request carries. The attributes match
 * the ones the legacy cookies were set with, so the browser replaces them.
 */
export const expireLegacySessionCookies = createServerOnlyFn((): void => {
	const cookies = getCookies();
	for (const name of LEGACY_SESSION_COOKIES) {
		if (name in cookies) {
			deleteCookie(name, {
				httpOnly: true,
				secure: isSecure(),
				sameSite: "lax",
				path: "/",
			});
		}
	}
});

/** Read/write/clear access to the restricted setup cookies. */
export type CookieAdapter = {
	getSetupSessionId(): string | undefined;
	getSetupSessionToken(): string | undefined;
	setSetupSession(
		sessionId: string,
		token: string,
		maxAgeSeconds?: number,
	): void;
	clearSetup(): void;
};

/* Each method is wrapped in createServerOnlyFn so the references to
   getCookie/setCookie/deleteCookie sit behind a server boundary the compiler
   recognizes — otherwise the object literal at module scope would pin
   @tanstack/react-start/server in any client-reachable import chain. */
export const realCookies: CookieAdapter = {
	getSetupSessionId: createServerOnlyFn(() =>
		getCookie(SETUP_SESSION_ID_COOKIE),
	),
	getSetupSessionToken: createServerOnlyFn(() =>
		getCookie(SETUP_SESSION_TOKEN_COOKIE),
	),
	/* Both halves together, because a setup session is worthless without either
	   and there is no flow that sets one alone. */
	setSetupSession: createServerOnlyFn(
		(
			sessionId: string,
			token: string,
			maxAgeSeconds = SETUP_MAX_AGE_SECONDS,
		) => {
			setCookie(
				SETUP_SESSION_ID_COOKIE,
				sessionId,
				cookieOptions(isSecure(), maxAgeSeconds),
			);
			setCookie(
				SETUP_SESSION_TOKEN_COOKIE,
				token,
				cookieOptions(isSecure(), maxAgeSeconds),
			);
		},
	),
	clearSetup: createServerOnlyFn(() => {
		deleteCookie(SETUP_SESSION_ID_COOKIE, { path: "/" });
		deleteCookie(SETUP_SESSION_TOKEN_COOKIE, { path: "/" });
	}),
};
