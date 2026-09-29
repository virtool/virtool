import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import * as Sentry from "@sentry/tanstackstart-react";
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Whether this browser can run a passkey ceremony.
 *
 * `pending` during server rendering and hydration, before the browser can be
 * asked.
 */
export type PasskeySupport = "pending" | "unavailable" | "available";

/** Why a passkey ceremony ended without a credential. */
type PasskeyErrorKind =
	| "cancelled"
	| "incomplete"
	| "duplicate"
	| "unsupported"
	| "failed";

const PASSKEY_CEREMONY_ERROR_NAME = "PasskeyCeremonyError";

/** A passkey ceremony that the browser or authenticator ended. */
export class PasskeyCeremonyError extends Error {
	readonly kind: PasskeyErrorKind;

	constructor(kind: PasskeyErrorKind, message: string) {
		super(message);
		this.name = PASSKEY_CEREMONY_ERROR_NAME;
		this.kind = kind;
	}
}

type BrowserModule = typeof import("@simplewebauthn/browser");

let browserModule: Promise<BrowserModule> | null = null;
let loadedModule: BrowserModule | null = null;

function loadBrowserModule(): Promise<BrowserModule> {
	browserModule ??= import("@simplewebauthn/browser").then((module) => {
		loadedModule = module;
		return module;
	});
	return browserModule;
}

function subscribe() {
	return () => {};
}

function getSupport(): PasskeySupport {
	return window.isSecureContext &&
		typeof window.PublicKeyCredential === "function"
		? "available"
		: "unavailable";
}

function getServerSupport(): PasskeySupport {
	return "pending";
}

/**
 * Read whether this browser can run a passkey ceremony.
 *
 * This decides only what to offer. The server still verifies every ceremony.
 */
export function usePasskeySupport(): PasskeySupport {
	return useSyncExternalStore(subscribe, getSupport, getServerSupport);
}

// Messages are fixed strings, never the browser's own, which can name the
// origin, the RP ID or the authenticator.
function toCeremonyError(
	error: unknown,
	incompleteMessage: string,
): PasskeyCeremonyError {
	const name = error instanceof Error ? error.name : "";
	const code =
		error instanceof Error && "code" in error ? String(error.code) : "";

	if (name === "AbortError" || code === "ERROR_CEREMONY_ABORTED") {
		return new PasskeyCeremonyError(
			"cancelled",
			"The passkey request was cancelled.",
		);
	}
	// Browsers use NotAllowedError for a user cancel, a timeout, and a request
	// that the browser refused. They do not tell these apart, so the user gets
	// a neutral message and not silence.
	if (name === "NotAllowedError") {
		return new PasskeyCeremonyError("incomplete", incompleteMessage);
	}
	if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
		return new PasskeyCeremonyError(
			"duplicate",
			"This passkey is already registered.",
		);
	}
	if (
		name === "NotSupportedError" ||
		name === "SecurityError" ||
		code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" ||
		code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT"
	) {
		return new PasskeyCeremonyError(
			"unsupported",
			"This browser or authenticator cannot use a passkey here.",
		);
	}

	Sentry.captureException(new Error("Passkey ceremony failed"), {
		extra: { name, code },
	});
	return new PasskeyCeremonyError(
		"failed",
		"The passkey request failed. Try again.",
	);
}

/** Ask the browser to create a passkey from server-generated options. */
export async function createPasskey(
	optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<Omit<RegistrationResponseJSON, "clientExtensionResults">> {
	const { startRegistration } = await loadBrowserModule();
	try {
		const { clientExtensionResults: _, ...response } = await startRegistration({
			optionsJSON,
		});
		return response;
	} catch (error) {
		throw toCeremonyError(error, "The passkey was not added. Try again.");
	}
}

/** Ask the browser to sign a server-generated challenge with a passkey. */
export async function getPasskeyAssertion(
	optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<Omit<AuthenticationResponseJSON, "clientExtensionResults">> {
	const { startAuthentication } = await loadBrowserModule();
	try {
		const { clientExtensionResults: _, ...response } =
			await startAuthentication({ optionsJSON });
		return response;
	} catch (error) {
		throw toCeremonyError(
			error,
			"Passkey sign-in did not finish. Try again, or sign in with your password.",
		);
	}
}

/**
 * Run at most one passkey ceremony at a time from a component.
 *
 * A second call while one is running joins it rather than starting another,
 * which would make the browser abort the first. Unmounting cancels a running
 * ceremony so the browser dialog does not outlive the component.
 */
export function useSingleCeremony<T>(
	ceremony: () => Promise<T>,
): () => Promise<T> {
	const running = useRef<Promise<T> | null>(null);

	useEffect(
		() => () => {
			if (running.current) {
				loadedModule?.WebAuthnAbortService.cancelCeremony();
			}
		},
		[],
	);

	return useCallback(() => {
		running.current ??= ceremony().finally(() => {
			running.current = null;
		});
		return running.current;
	}, [ceremony]);
}

/**
 * The message to show for a failed passkey action, or `null` when it was
 * stopped on purpose and there is nothing to report.
 *
 * Only messages written for the user are shown: a ceremony error from this
 * module or a deliberate server refusal.
 */
export function getPasskeyErrorMessage(error: unknown): string | null {
	if (!(error instanceof Error)) {
		return null;
	}
	if (error instanceof PasskeyCeremonyError) {
		return error.kind === "cancelled" ? null : error.message;
	}
	if (isRecentAuthenticationCancelled(error)) {
		return null;
	}
	if (error.name === CLIENT_ERROR_NAME && error.message) {
		return error.message;
	}
	return "Something went wrong. Try again.";
}
