import { useSyncExternalStore } from "react";

/**
 * Whether this browser can run a passkey ceremony.
 *
 * `pending` during server rendering and hydration, before the browser can be
 * asked.
 */
type PasskeySupport = "pending" | "unavailable" | "available";

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
 * It is apart from `@app/passkeys` so that a component can offer a passkey
 * without loading the ceremony code.
 */
export function usePasskeySupport(): PasskeySupport {
	return useSyncExternalStore(subscribe, getSupport, getServerSupport);
}
