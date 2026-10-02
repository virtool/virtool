import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import * as Sentry from "@sentry/tanstackstart-react";
import { PROTECTED_OPERATIONS } from "@server/auth/freshness";
import { challengeRecentAuthenticationFn } from "@server/auth/recentAuthentication";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import {
	CLIENT_ERROR_NAME,
	RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH,
	SESSION_NOT_FRESH_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { useCallback, useEffect, useRef } from "react";

/** Why a passkey ceremony ended without a credential. */
type PasskeyErrorKind =
	| "cancelled"
	| "incomplete"
	| "duplicate"
	| "unsupported"
	| "failed";

const PASSKEY_CEREMONY_ERROR_NAME = "PasskeyCeremonyError";

/** A passkey ceremony that the browser, authenticator, or server ended. */
export class PasskeyCeremonyError extends Error {
	readonly kind: PasskeyErrorKind;

	constructor(kind: PasskeyErrorKind, message: string) {
		super(message);
		this.name = PASSKEY_CEREMONY_ERROR_NAME;
		this.kind = kind;
	}
}

/** The error part of a Better Auth client result. */
type AuthClientError = {
	code?: string;
	status: number;
};

type AuthClient = typeof import("./authClient")["authClient"];

type AbortService =
	typeof import("@simplewebauthn/browser")["WebAuthnAbortService"];

let authClientModule: Promise<AuthClient> | null = null;
let loadedAbortService: AbortService | null = null;

// The client plugin starts each ceremony through this same abort service, so
// it can cancel the ceremony that is running.
function loadAuthClient(): Promise<AuthClient> {
	authClientModule ??= Promise.all([
		import("@app/authClient"),
		import("@simplewebauthn/browser"),
	]).then(
		([{ authClient }, { WebAuthnAbortService }]) => {
			loadedAbortService = WebAuthnAbortService;
			return authClient;
		},
		(error: unknown) => {
			authClientModule = null;
			throw error;
		},
	);
	return authClientModule;
}

// Browsers use NotAllowedError for a user cancel, a timeout, and a request that
// the browser refused. The WebAuthn library passes it through with this code.
const INCOMPLETE_CODE = "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY";

const UNSUPPORTED_CODES = new Set([
	"ERROR_INVALID_DOMAIN",
	"ERROR_INVALID_RP_ID",
	"ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
	"ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
	"ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
]);

// The client plugin uses these codes for any failure it does not recognize.
const UNEXPECTED_CODES = new Set([
	"AUTH_CANCELLED",
	"UNKNOWN_ERROR",
	"ERROR_AUTHENTICATOR_GENERAL_ERROR",
]);

// Messages are fixed strings. The browser's and the server's own messages can
// name the origin, the RP ID, or the authenticator.
function toBrowserError(
	{ code }: AuthClientError,
	incompleteMessage: string,
): PasskeyCeremonyError | null {
	if (code === "ERROR_CEREMONY_ABORTED") {
		return new PasskeyCeremonyError(
			"cancelled",
			"The passkey request was cancelled.",
		);
	}
	// The user gets a neutral notice and not silence, because the browser does
	// not say which of the three it was.
	if (code === INCOMPLETE_CODE) {
		return new PasskeyCeremonyError("incomplete", incompleteMessage);
	}
	if (code && UNSUPPORTED_CODES.has(code)) {
		return new PasskeyCeremonyError(
			"unsupported",
			"This browser or authenticator cannot use a passkey here.",
		);
	}
	return null;
}

function toFailure(error: AuthClientError, message: string): Error {
	if (error.status >= 500 || (error.code && UNEXPECTED_CODES.has(error.code))) {
		Sentry.captureException(new Error("Passkey ceremony failed"), {
			extra: { code: error.code, status: error.status },
		});
	}
	return new PasskeyCeremonyError("failed", message);
}

function toSignInError(error: AuthClientError): Error {
	const browserError = toBrowserError(
		error,
		"Passkey sign-in did not finish. Try again, or sign in with your password.",
	);
	if (browserError) {
		return browserError;
	}
	if (error.status === 429) {
		return new PasskeyCeremonyError(
			"failed",
			"Too many sign-in attempts. Wait and try again.",
		);
	}
	return toFailure(
		error,
		"Passkey sign-in failed. Try again or sign in with your password.",
	);
}

function toRegistrationError(error: AuthClientError): Error {
	if (error.code === SESSION_NOT_FRESH_ERROR_NAME) {
		return Object.assign(new Error("Recent authentication required"), {
			name: SESSION_NOT_FRESH_ERROR_NAME,
			operation: PROTECTED_OPERATIONS.passkeyRegister,
		});
	}
	if (error.status === 401 && error.code === "UNAUTHORIZED") {
		return Object.assign(new Error("Unauthorized"), {
			name: UNAUTHORIZED_ERROR_NAME,
		});
	}
	if (
		error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" ||
		error.code === "PASSKEY_ALREADY_REGISTERED"
	) {
		return new PasskeyCeremonyError(
			"duplicate",
			"This passkey is already registered.",
		);
	}
	return (
		toBrowserError(error, "The passkey was not added. Try again.") ??
		toFailure(error, "The passkey could not be registered. Try again.")
	);
}

function toRecentAuthenticationError(error: AuthClientError): Error {
	if (error.status === 401 && error.code === "UNAUTHORIZED") {
		return Object.assign(new Error("Unauthorized"), {
			name: UNAUTHORIZED_ERROR_NAME,
		});
	}
	const browserError = toBrowserError(
		error,
		"Passkey verification did not finish. Try again.",
	);
	if (browserError) {
		return browserError;
	}
	if (error.status === 429) {
		return new PasskeyCeremonyError(
			"failed",
			"Too many attempts. Wait and try again.",
		);
	}
	return toFailure(error, "Your passkey could not be verified. Try again.");
}

/** Sign in with a discoverable passkey through Better Auth. */
export async function signInWithPasskey(): Promise<void> {
	const authClient = await loadAuthClient();
	const { error } = await authClient.signIn.passkey();
	if (error) {
		throw toSignInError(error);
	}
}

/**
 * Offer passkeys in the autofill of the username field, where the browser
 * supports it.
 *
 * The field must have `webauthn` in its `autocomplete`. Resolves `true` when a
 * passkey signed the user in, and `false` when the browser has no autofill or
 * the ceremony stopped, for example because an explicit passkey sign-in
 * replaced it.
 */
export async function signInWithPasskeyAutofill(): Promise<boolean> {
	const [authClient, { browserSupportsWebAuthnAutofill }] = await Promise.all([
		loadAuthClient(),
		import("@simplewebauthn/browser"),
	]);
	if (!(await browserSupportsWebAuthnAutofill())) {
		return false;
	}
	const { error } = await authClient.signIn.passkey({ autoFill: true });
	if (!error) {
		return true;
	}
	const { code } = error as AuthClientError;
	const browserError = toBrowserError({ code, status: error.status }, "");
	if (
		browserError?.kind === "cancelled" ||
		browserError?.kind === "incomplete" ||
		code === "AUTH_CANCELLED"
	) {
		return false;
	}
	throw toSignInError(error);
}

/**
 * Confirm the identity of the signed-in user with one of their passkeys.
 *
 * Errors from the challenge server function pass through unchanged, so the
 * caller can tell a refused passkey from a failure that ends the challenge.
 */
export async function verifyRecentAuthenticationWithPasskey(): Promise<void> {
	const authClient = await loadAuthClient();
	const { startAuthentication, WebAuthnError } = await import(
		"@simplewebauthn/browser"
	);

	const options =
		await authClient.$fetch<PublicKeyCredentialRequestOptionsJSON>(
			RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH,
			{ method: "GET", throw: false },
		);
	if (options.error) {
		throw toRecentAuthenticationError(options.error);
	}

	const response = await startAuthentication({
		optionsJSON: options.data,
	}).catch((error: unknown) => {
		throw toRecentAuthenticationError({
			code: error instanceof WebAuthnError ? error.code : "AUTH_CANCELLED",
			status: 400,
		});
	});

	await challengeRecentAuthenticationFn({
		data: {
			method: "passkey",
			response: { ...response, clientExtensionResults: {} },
		},
	});
}

/** Stop the passkey ceremony that is running, if there is one. */
export function cancelPasskeyCeremony() {
	loadedAbortService?.cancelCeremony();
}

/**
 * Register a passkey for the signed-in user through Better Auth.
 *
 * `name` is the account label that the authenticator shows in its picker, and
 * the stored name of the new passkey.
 */
export async function addPasskey(name: string): Promise<void> {
	const authClient = await loadAuthClient();
	const { error } = await authClient.passkey.addPasskey({ name });
	if (error) {
		throw toRegistrationError(error);
	}
}

/**
 * Run at most one passkey ceremony at a time from a component.
 *
 * A second call while one is running joins it rather than starting another,
 * which would make the browser abort the first. Unmounting cancels a running
 * ceremony so the browser dialog does not outlive the component.
 */
export function useSingleCeremony<TVariables, T>(
	ceremony: (variables: TVariables) => Promise<T>,
): (variables: TVariables) => Promise<T> {
	const running = useRef<Promise<T> | null>(null);

	useEffect(
		() => () => {
			if (running.current) {
				loadedAbortService?.cancelCeremony();
			}
		},
		[],
	);

	return useCallback(
		(variables: TVariables) => {
			running.current ??= ceremony(variables).finally(() => {
				running.current = null;
			});
			return running.current;
		},
		[ceremony],
	);
}

/** A message about a failed passkey action and how strongly to show it. */
export type PasskeyNotice = {
	message: string;
	tone: "error" | "neutral";
};

/**
 * The notice to show for a failed passkey action, or `null` when it was
 * stopped on purpose and there is nothing to report.
 *
 * Only messages written for the user are shown: a ceremony error from this
 * module or a deliberate server refusal. An incomplete ceremony is neutral
 * because it is usually a deliberate cancel.
 */
export function getPasskeyNotice(error: unknown): PasskeyNotice | null {
	if (!(error instanceof Error)) {
		return null;
	}
	if (error instanceof PasskeyCeremonyError) {
		if (error.kind === "cancelled") {
			return null;
		}
		return {
			message: error.message,
			tone: error.kind === "incomplete" ? "neutral" : "error",
		};
	}
	if (isRecentAuthenticationCancelled(error)) {
		return null;
	}
	if (error.name === CLIENT_ERROR_NAME && error.message) {
		return { message: error.message, tone: "error" };
	}
	return { message: "Something went wrong. Try again.", tone: "error" };
}
