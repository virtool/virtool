import { getRootFn } from "../root/functions";
import { getPasswordPolicyFn } from "../settings/functions";
import {
	createFirstUserFn,
	loginFn,
	logoutFn,
	resetPasswordFn,
} from "./functions";

/**
 * Server functions exempt from global authentication.
 *
 * logoutFn must be exempt so stale or missing cookies can still be cleared.
 *
 * createFirstUserFn runs before any user or session exists.
 *
 * getPasswordPolicyFn serves the first-user and forced-reset forms, which set a
 * password before there is a session to authenticate.
 *
 * getRootFn reports whether first-user setup is needed, read by the
 * `_authenticated` guard before a session exists.
 *
 * It is a module of its own rather than an array inlined into the middleware so
 * it can be asserted on. `middleware.test.ts` pins its exact contents and
 * `authorization.test.ts` pins it against the `open()` declarations in both
 * directions, so a function added here by mistake fails a test instead of
 * silently becoming publicly callable.
 */
export const authenticationExceptions: ReadonlyArray<{ url: string }> = [
	createFirstUserFn,
	getPasswordPolicyFn,
	getRootFn,
	loginFn,
	logoutFn,
	resetPasswordFn,
];
