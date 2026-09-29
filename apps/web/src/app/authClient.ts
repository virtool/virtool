import { passkeyClient } from "@better-auth/passkey/client";
import { AUTH_BASE_PATH } from "@virtool/contracts";
import { createAuthClient } from "better-auth/client";

/**
 * The browser client for the Better Auth handler at `/api/auth`.
 *
 * Import this module dynamically. It loads the WebAuthn browser library, which
 * only a passkey ceremony needs.
 */
export const authClient = createAuthClient({
	basePath: AUTH_BASE_PATH,
	plugins: [passkeyClient()],
});
