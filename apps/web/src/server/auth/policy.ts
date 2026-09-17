import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import {
	AdministratorPermissions,
	type AdministratorRoleName,
	type AuthenticatedPrincipal,
	type BrowserPrincipal,
	hasSufficientAdminRole,
	isApiKeyPrincipal,
	isBrowserPrincipal,
	isPasswordResetPrincipal,
	isSetupPrincipal,
	type PasswordResetPrincipal,
	type Permission,
	type SetupPrincipal,
	type SetupPurpose,
} from "@virtool/contracts";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import { users } from "@virtool/data/db/schema/users";
import { eq } from "drizzle-orm";
import { db } from "../composition";
import {
	ForbiddenError,
	requireBrowserPrincipal,
	UnauthorizedError,
} from "./middleware";
import {
	PasswordResetRequiredError,
	resolveRestrictedSetup,
} from "./restricted";

// Every server function declares one of the policies below with `.middleware()`.
// A policy answers *what the caller may do*; the global authentication
// middleware has already answered *who they are*. It states a floor, resolved
// before the handler runs — a rule that depends on the row being touched stays
// in the handler, after the read, with `requireAdminRole`.
//
// It cannot be a wrapper around `createServerFn` — the Vite plugin matches that
// call syntactically at the definition site, and behind a factory it stops
// recognising the function as a server function at all (no RPC endpoint, and the
// handler body ships to the browser). So the policy is a middleware, the
// declaration is a convention, and `authorization.test.ts` is what makes the
// convention non-optional: it calls every server function with no session and
// fails the build on any that does not refuse.

// The global authentication middleware has already resolved the session and put
// it here. Reusing it keeps an authenticated call to a single session lookup.
type UpstreamContext = {
	principal?: BrowserPrincipal | PasswordResetPrincipal | SetupPrincipal | null;
};

// Absent only in tests, which run a handler without the global middleware.
const resolveBrowser = createServerOnlyFn(
	async (context: unknown): Promise<BrowserPrincipal> => {
		const principal = (context as UpstreamContext).principal;
		if (principal && isBrowserPrincipal(principal)) {
			return principal;
		}
		if (principal && isPasswordResetPrincipal(principal)) {
			setResponseStatus(403);
			throw new PasswordResetRequiredError();
		}
		return requireBrowserPrincipal();
	},
);

const forbid = createServerOnlyFn((): never => {
	setResponseStatus(403);
	throw new ForbiddenError();
});

// Absent only in tests, which run a handler without the global middleware.
//
// 401, not 403: with no restricted credential resolved there is no caller to
// forbid, and this is the answer every other policy gives an anonymous call.
const resolveSetup = createServerOnlyFn(
	async (context: unknown): Promise<SetupPrincipal> => {
		const principal = (context as UpstreamContext).principal;
		if (principal && isSetupPrincipal(principal)) {
			return principal;
		}

		const restricted = await resolveRestrictedSetup(getRequest());

		if (!restricted) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}

		return { kind: "setup", ...restricted };
	},
);

const resolvePasswordReset = createServerOnlyFn(
	async (context: unknown): Promise<PasswordResetPrincipal> => {
		const principal = (context as UpstreamContext).principal;
		if (principal && isPasswordResetPrincipal(principal)) {
			return principal;
		}

		setResponseStatus(401);
		throw new UnauthorizedError();
	},
);

/**
 * Whether the user holds `name` — through the union of their groups'
 * permissions, or by holding an administrator role that covers it.
 *
 * Mirrors `checkAdminRoleOrPermissionsFromAccount` on the client: the two must
 * agree, or the UI offers an action the server then refuses.
 *
 * A session authenticated with an API key carries that key's permissions, and
 * they cap the answer: the effective set is the intersection of what the user
 * may do and what the key was granted. The cap applies to administrators too:
 * the account UI offers an administrator a checkbox per permission and promises
 * the key reverts to a smaller set if their role shrinks, so a key that ignored
 * its own checkboxes would be a lie.
 */
export const hasPermission = createServerOnlyFn(
	async (
		principal: AuthenticatedPrincipal,
		name: Permission,
	): Promise<boolean> => {
		if (isApiKeyPrincipal(principal) && !principal.permissions[name]) {
			return false;
		}

		const [row] = await db
			.select({ administratorRole: users.administratorRole })
			.from(users)
			.where(eq(users.id, principal.userId))
			.limit(1);

		if (!row) {
			return false;
		}

		if (
			hasSufficientAdminRole(
				AdministratorPermissions[name],
				row.administratorRole,
			)
		) {
			return true;
		}

		const memberships = await db
			.select({ permissions: groups.permissions })
			.from(groups)
			.innerJoin(userGroups, eq(userGroups.groupId, groups.id))
			.where(eq(userGroups.userId, principal.userId));

		return memberships.some((membership) => membership.permissions[name]);
	},
);

/**
 * Callable without an ordinary session. Reserved for endpoints that establish
 * or clear one, plus bootstrap and password-policy reads.
 *
 * A function declared `open()` must also appear in `authenticationExceptions`,
 * and one that isn't declared `open()` must not — `authorization.test.ts` pins
 * both directions.
 */
export function open() {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal =
				(context as unknown as UpstreamContext).principal ?? null;
			return next({ context: { principal } });
		},
	);
}

/**
 * Callable by any signed-in user. The deliberate choice for reads that carry no
 * secret — the job list, the group list, labels — and not a fallback for "I
 * haven't decided yet".
 */
export function authenticated() {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal = await resolveBrowser(context);
			return next({ context: { principal } });
		},
	);
}

/**
 * Callable only by an administrator holding at least `role`.
 */
export function adminRole(role: AdministratorRoleName) {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal = await resolveBrowser(context);

			const [row] = await db
				.select({ administratorRole: users.administratorRole })
				.from(users)
				.where(eq(users.id, principal.userId))
				.limit(1);

			if (!row || !hasSufficientAdminRole(role, row.administratorRole)) {
				forbid();
			}

			return next({ context: { principal } });
		},
	);
}

/**
 * Callable by a user granted `name` through group membership, or by an
 * administrator whose role covers it.
 */
export function permission(name: Permission) {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal = await resolveBrowser(context);

			if (!(await hasPermission(principal, name))) {
				forbid();
			}

			return next({ context: { principal } });
		},
	);
}

/**
 * Callable only by a restricted setup principal whose credential is for
 * `purpose`, and by nobody else.
 *
 * The counterpart to the global middleware's allowlist, and both are required.
 * The middleware decides whether a restricted caller may reach this function
 * at all; this decides whether the purpose they hold is the one the function
 * completes, so an `email_remediation` credential cannot be spent on a TOTP
 * enrollment endpoint.
 *
 * An ordinary authenticated user is refused too. Reaching a setup surface
 * means a transition is outstanding, and for a user who has completed setup
 * none is — offering them one would be offering a second way to change a
 * credential they can already change through their account.
 *
 * A function declaring this must appear in `./setupExceptions`, and one that
 * appears there must declare it. `authorization.test.ts` pins both directions.
 *
 * @public
 */
export function setupOnly(purpose: SetupPurpose) {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal = await resolveSetup(context);

			if (principal.purpose !== purpose) {
				forbid();
			}

			return next({ context: { principal } });
		},
	);
}

/** Callable only while the Better Auth session requires a password reset. */
export function passwordResetOnly() {
	return createMiddleware({ type: "function" }).server(
		async ({ context, next }) => {
			const principal = await resolvePasswordReset(context);
			return next({ context: { principal } });
		},
	);
}
