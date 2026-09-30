import { expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({
	isUnavailable: true,
	signInPasskey: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => {
	if (browser.isUnavailable) {
		throw new Error("Failed to fetch dynamically imported module");
	}
	return { WebAuthnAbortService: { cancelCeremony: vi.fn() } };
});

vi.mock("@app/authClient", () => ({
	authClient: { signIn: { passkey: browser.signInPasskey } },
}));

import { signInWithPasskey } from "../passkeys";

it("loads the ceremony modules again after a failed import", async () => {
	await expect(signInWithPasskey()).rejects.toThrow();

	browser.isUnavailable = false;
	browser.signInPasskey.mockResolvedValue({ data: {}, error: null });

	await expect(signInWithPasskey()).resolves.toBeUndefined();
});
