import type { Permissions } from "./permissions";
import type { RestrictedSetup } from "./setup";

/** A human authorized for ordinary application access by a browser session. */
export type BrowserPrincipal = {
	kind: "browser";
	userId: number;
	/** Stable session-row identifier; never the bearer token. */
	sessionId: number;
	/** Immutable time at which this browser session was created. */
	createdAt: Date;
	sessionStore: "better_auth" | "legacy";
};

/** A signed-in human restricted to replacing a forced-reset password. */
export type PasswordResetPrincipal = {
	kind: "password_reset";
	userId: number;
	/** Stable session-row identifier; never the bearer token. */
	sessionId: number;
	/** Immutable time at which this browser session was created. */
	createdAt: Date;
	sessionStore: "better_auth" | "legacy";
};

/** A machine caller authenticated by a Virtool API key. */
export type ApiKeyPrincipal = {
	kind: "api_key";
	userId: number;
	/** Stable database identifier; never the key or its digest. */
	keyId: number;
	permissions: Permissions;
};

/** A browser restricted to completing one setup transition. */
export type SetupPrincipal = RestrictedSetup & {
	kind: "setup";
};

/** A principal accepted by ordinary Virtool authorization policies. */
export type AuthenticatedPrincipal = BrowserPrincipal | ApiKeyPrincipal;

/** A principal backed by a Better Auth or retained legacy browser session. */
export type BrowserSessionPrincipal = BrowserPrincipal | PasswordResetPrincipal;

/** Any credential resolved by the web authentication boundary. */
export type AuthenticationPrincipal =
	| AuthenticatedPrincipal
	| PasswordResetPrincipal
	| SetupPrincipal;

/** Whether a principal has ordinary browser-session authority. */
export function isBrowserPrincipal(
	principal: AuthenticationPrincipal,
): principal is BrowserPrincipal {
	return principal.kind === "browser";
}

/** Whether a principal was authenticated by an API key. */
export function isApiKeyPrincipal(
	principal: AuthenticationPrincipal,
): principal is ApiKeyPrincipal {
	return principal.kind === "api_key";
}

/** Whether a principal must replace its password before ordinary access. */
export function isPasswordResetPrincipal(
	principal: AuthenticationPrincipal,
): principal is PasswordResetPrincipal {
	return principal.kind === "password_reset";
}

/** Whether a principal is restricted to one setup purpose. */
export function isSetupPrincipal(
	principal: AuthenticationPrincipal,
): principal is SetupPrincipal {
	return principal.kind === "setup";
}
