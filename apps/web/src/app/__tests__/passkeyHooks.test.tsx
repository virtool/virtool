import { act, render, renderHook, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePasskeySupport } from "../passkeySupport";
import { addPasskey, useSingleCeremony } from "../passkeys";

const client = vi.hoisted(() => ({
	addPasskey: vi.fn(),
	browserSupportsAutofill: vi.fn(),
	cancelCeremony: vi.fn(),
	fetch: vi.fn(),
	signInPasskey: vi.fn(),
	startAuthentication: vi.fn(),
}));

vi.mock("@app/authClient", () => ({
	authClient: {
		$fetch: client.fetch,
		passkey: { addPasskey: client.addPasskey },
		signIn: { passkey: client.signInPasskey },
	},
}));

vi.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthnAutofill: client.browserSupportsAutofill,
	startAuthentication: client.startAuthentication,
	WebAuthnAbortService: { cancelCeremony: client.cancelCeremony },
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

function stubPasskeySupport(secure: boolean, credential: boolean) {
	vi.stubGlobal("isSecureContext", secure);
	vi.stubGlobal(
		"PublicKeyCredential",
		credential ? function PublicKeyCredential() {} : undefined,
	);
}

function Support() {
	return <span>{usePasskeySupport()}</span>;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("usePasskeySupport", () => {
	it("renders pending on the server and hydrates without a mismatch", async () => {
		stubPasskeySupport(true, true);
		const html = renderToString(<Support />);
		expect(html).toBe("<span>pending</span>");

		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.append(container);
		const onRecoverableError = vi.fn();

		await act(async () => {
			hydrateRoot(container, <Support />, { onRecoverableError });
		});

		expect(container.textContent).toBe("available");
		expect(onRecoverableError).not.toHaveBeenCalled();
		container.remove();
	});

	it.each([
		["an insecure context", false, true],
		["a browser without WebAuthn", true, false],
	])("reports unavailable in %s", (_, secure, credential) => {
		stubPasskeySupport(secure, credential);

		render(<Support />);

		expect(screen.getByText("unavailable")).toBeInTheDocument();
	});
});

describe("useSingleCeremony", () => {
	it("joins a second call instead of starting another ceremony", async () => {
		const deferred = Promise.withResolvers<string>();
		const ceremony = vi.fn(() => deferred.promise);
		const { result } = renderHook(() => useSingleCeremony(ceremony));

		const first = result.current(undefined);
		const second = result.current(undefined);
		deferred.resolve("done");

		await expect(first).resolves.toBe("done");
		await expect(second).resolves.toBe("done");
		expect(ceremony).toHaveBeenCalledTimes(1);
	});

	it("starts a new ceremony once the previous one settles", async () => {
		const ceremony = vi.fn(() => Promise.resolve("done"));
		const { result } = renderHook(() => useSingleCeremony(ceremony));

		await result.current(undefined);
		await result.current(undefined);

		expect(ceremony).toHaveBeenCalledTimes(2);
	});

	it("cancels a running ceremony on unmount", async () => {
		client.addPasskey.mockReturnValue(new Promise(() => {}));
		const { result, unmount } = renderHook(() =>
			useSingleCeremony<void, void>(addPasskey),
		);

		result.current();
		await vi.waitFor(() => expect(client.addPasskey).toHaveBeenCalled());
		unmount();

		expect(client.cancelCeremony).toHaveBeenCalledTimes(1);
	});

	it("does not cancel anything on unmount when idle", () => {
		const { unmount } = renderHook(() =>
			useSingleCeremony(() => Promise.resolve()),
		);

		unmount();

		expect(client.cancelCeremony).not.toHaveBeenCalled();
	});
});
