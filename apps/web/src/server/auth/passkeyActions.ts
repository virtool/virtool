import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

const base64Url = z.string().regex(/^[A-Za-z0-9_-]*$/);

const credentialId = base64Url.min(1).max(1366);

const transportsSchema = z
	.array(
		z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]),
	)
	.max(7);

const authenticatorAttachment = z.enum(["platform", "cross-platform"]);

// Neither schema carries `clientExtensionResults`. Virtool requests no
// extensions, and the plugin never reads them.

/** A browser's `RegistrationResponseJSON`, bounded in size. */
export const registrationResponseSchema = z.object({
	id: credentialId,
	rawId: credentialId,
	type: z.literal("public-key"),
	response: z.object({
		clientDataJSON: base64Url.max(8192),
		attestationObject: base64Url.max(65536),
		authenticatorData: base64Url.max(65536).optional(),
		publicKey: base64Url.max(8192).optional(),
		publicKeyAlgorithm: z.number().int().optional(),
		transports: transportsSchema.optional(),
	}),
	authenticatorAttachment: authenticatorAttachment.optional(),
});

/** A browser's `AuthenticationResponseJSON`, bounded in size. */
export const authenticationResponseSchema = z.object({
	id: credentialId,
	rawId: credentialId,
	type: z.literal("public-key"),
	response: z.object({
		clientDataJSON: base64Url.max(8192),
		authenticatorData: base64Url.max(65536),
		signature: base64Url.max(2048),
		userHandle: base64Url.max(128).optional(),
	}),
	authenticatorAttachment: authenticatorAttachment.optional(),
});

async function loadAuth() {
	const [{ getRequest }, { auth }] = await Promise.all([
		import("@tanstack/react-start/server"),
		import("./instance"),
	]);
	return { auth, headers: getRequest().headers };
}

/**
 * Generate registration options for the current session's user.
 *
 * The plugin names the credential after the user's email. The authenticator
 * shows that name in its account picker, so it is replaced with the handle the
 * user signs in with.
 */
export const generatePasskeyRegistrationOptions = createServerOnlyFn(
	async (handle: string) => {
		const { auth, headers } = await loadAuth();
		const options = await auth.api.generatePasskeyRegistrationOptions({
			headers,
		});
		return {
			...options,
			user: { ...options.user, name: handle, displayName: handle },
		};
	},
);

/** Verify a registration response and store the new passkey. */
export const verifyPasskeyRegistration = createServerOnlyFn(
	async (response: z.infer<typeof registrationResponseSchema>) => {
		const { auth, headers } = await loadAuth();
		return auth.api.verifyPasskeyRegistration({
			headers,
			body: { response },
		});
	},
);

/** A passkey sign-in that Better Auth refused with a client error status. */
export class PasskeySignInRefusedError extends Error {
	readonly status: number;

	constructor(status: number) {
		super("Passkey sign-in refused.");
		this.status = status;
	}
}

const signInResultSchema = z.union([
	z.object({ twoFactorRedirect: z.literal(true) }),
	z.object({ user: z.object({ id: z.coerce.number().int().positive() }) }),
]);

/**
 * Send a passkey sign-in request through Better Auth's HTTP handler.
 *
 * `auth.api` calls skip the rate limiter, which Better Auth applies only in its
 * router. The request goes to `auth.handler` and not to `handleAuthRequest`,
 * because that wrapper refuses these paths to the browser. Its forced-reset and
 * required-MFA gates are for signed-in callers. A sign-in makes a new session,
 * and the wrapper gates that session on its next request.
 *
 * The router does not let `tanstackStartCookies` copy cookies, so this function
 * copies each `set-cookie` onto the server function response.
 */
async function sendSignInRequest(
	path: "options" | "verify",
	body?: unknown,
): Promise<unknown> {
	const [
		{ getRequest, setCookie },
		{ parseSetCookieHeader, toCookieOptions },
		{ AUTH_BASE_PATH, PASSKEY_SIGN_IN_OPTIONS_PATH, PASSKEY_SIGN_IN_PATH },
		{ auth },
	] = await Promise.all([
		import("@tanstack/react-start/server"),
		import("better-auth/cookies"),
		import("./betterAuth"),
		import("./instance"),
	]);

	const request = getRequest();
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	headers.delete("content-type");
	if (body !== undefined) {
		headers.set("content-type", "application/json");
	}

	const endpoint =
		path === "options" ? PASSKEY_SIGN_IN_OPTIONS_PATH : PASSKEY_SIGN_IN_PATH;
	const response = await auth.handler(
		new Request(
			new URL(`${AUTH_BASE_PATH}${endpoint}`, request.url),
			body === undefined
				? { method: "GET", headers }
				: { method: "POST", headers, body: JSON.stringify(body) },
		),
	);

	const setCookieHeader = response.headers.get("set-cookie");
	if (setCookieHeader) {
		for (const [name, cookie] of parseSetCookieHeader(setCookieHeader)) {
			setCookie(name, cookie.value, toCookieOptions(cookie));
		}
	}

	if (response.status >= 500) {
		throw new Error(`Passkey sign-in failed with status ${response.status}`);
	}
	if (!response.ok) {
		throw new PasskeySignInRefusedError(response.status);
	}

	return response.json();
}

/**
 * Generate options for a passkey sign-in.
 *
 * The plugin always asks for `preferred` user verification. The request is
 * raised to `required` so the browser does not offer an authenticator that the
 * server will then refuse.
 */
export const generatePasskeyAuthenticationOptions = createServerOnlyFn(
	async () => {
		const options = (await sendSignInRequest(
			"options",
		)) as PublicKeyCredentialRequestOptionsJSON;
		return { ...options, userVerification: "required" as const };
	},
);

/** Verify a passkey assertion and sign its user in. */
export const verifyPasskeyAuthentication = createServerOnlyFn(
	async (response: z.infer<typeof authenticationResponseSchema>) =>
		signInResultSchema.parse(
			await sendSignInRequest("verify", {
				response: { ...response, clientExtensionResults: {} },
			}),
		),
);
