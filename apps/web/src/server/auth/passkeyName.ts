import { getAuthenticatorName } from "@better-auth/passkey";
import { DEFAULT_PASSKEY_NAME } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { getUserHandle } from "@virtool/data/users/data";
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import { getUserAgentLabel } from "./sessionMetadata";

/**
 * The stored name of a new passkey: its provider, or else the browser and
 * operating system that registered it.
 *
 * The user can rename the passkey later.
 */
export function getNewPasskeyName(
	aaguid: string | undefined,
	userAgent: string | null,
): string {
	return (
		getAuthenticatorName(aaguid) ??
		getUserAgentLabel(userAgent) ??
		DEFAULT_PASSKEY_NAME
	);
}

/**
 * Keep the names of new passkeys out of the client's control.
 *
 * The authenticator labels a new passkey with the user's handle, whatever the
 * options request asks for. The registration request cannot name the passkey,
 * because the passkey plugin stores that name with no limits. The server names
 * it instead, and a rename goes through Virtool, which applies the limits.
 */
export function passkeyNamePlugin(db: Db) {
	return {
		id: "virtool-passkey-name",
		hooks: {
			before: [
				{
					matcher: (ctx) => ctx.path === "/passkey/generate-register-options",
					handler: createAuthMiddleware(async (ctx) => {
						const session = await getSessionFromCtx(ctx, {
							disableCookieCache: true,
							disableRefresh: true,
						});
						if (!session) {
							return;
						}

						const handle = await getUserHandle(db, Number(session.user.id));
						if (!handle) {
							return;
						}

						return { context: { query: { ...ctx.query, name: handle } } };
					}),
				},
				{
					matcher: (ctx) => ctx.path === "/passkey/verify-registration",
					handler: createAuthMiddleware(async (ctx) => {
						if (ctx.body?.name !== undefined) {
							throw new APIError("BAD_REQUEST", {
								code: "PASSKEY_NAME_NOT_ACCEPTED",
								message: "A new passkey cannot be named",
							});
						}
					}),
				},
			],
		},
	} satisfies BetterAuthPlugin;
}
