import { act, render, renderHook, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({
	cancelCeremony: vi.fn(),
	startAuthentication: vi.fn(),
	startRegistration: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
	startAuthentication: browser.startAuthentication,
	startRegistration: browser.startRegistration,
	WebAuthnAbortService: { cancelCeremony: browser.cancelCeremony },
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

import * as Sentry from "@sentry/tanstackstart-react";
import {
	createPasskey,
	getPasskeyAssertion,
	getPasskeyErrorMessage,
	PasskeyCeremonyError,
	usePasskeySupport,
	useSingleCeremony,
} from "../passkeys";

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

describe("ceremonies", () => {
	it("sends the browser response without client extension results", async () => {
		browser.startRegistration.mockResolvedValue({
			id: "id",
			clientExtensionResults: { credProps: { rk: true } },
		});

		await expect(createPasskey({} as never)).resolves.toEqual({ id: "id" });
	});

	it.each([
		["NotAllowedError", undefined, "incomplete"],
		["AbortError", undefined, "cancelled"],
		["AbortError", "ERROR_CEREMONY_ABORTED", "cancelled"],
		[
			"InvalidStateError",
			"ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
			"duplicate",
		],
		["SecurityError", "ERROR_INVALID_DOMAIN", "unsupported"],
		["NotSupportedError", undefined, "unsupported"],
	])("maps a %s to %s", async (name, code, kind) => {
		const error = Object.assign(new Error("https://virtool.test detail"), {
			name,
			code,
		});
		browser.startAuthentication.mockRejectedValue(error);

		const caught = await getPasskeyAssertion({} as never).catch((err) => err);

		expect(caught).toBeInstanceOf(PasskeyCeremonyError);
		expect(caught.kind).toBe(kind);
		expect(caught.message).not.toContain("virtool.test");
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("gives each ceremony its own message for a NotAllowedError", async () => {
		const notAllowed = Object.assign(new Error("https://virtool.test"), {
			name: "NotAllowedError",
		});
		browser.startRegistration.mockRejectedValue(notAllowed);
		browser.startAuthentication.mockRejectedValue(notAllowed);

		const [registration, assertion] = await Promise.all([
			createPasskey({} as never).catch((err) => err),
			getPasskeyAssertion({} as never).catch((err) => err),
		]);

		expect(getPasskeyErrorMessage(registration)).toBe(
			"The passkey was not added. Try again.",
		);
		expect(getPasskeyErrorMessage(assertion)).toBe(
			"Passkey sign-in did not finish. Try again, or sign in with your password.",
		);
	});

	it("reports an unexpected failure without the browser's payload", async () => {
		browser.startRegistration.mockRejectedValue(
			Object.assign(new Error("clientDataJSON=secret"), {
				name: "UnknownError",
			}),
		);

		const caught = await createPasskey({} as never).catch((err) => err);

		expect(caught.kind).toBe("failed");
		expect(Sentry.captureException).toHaveBeenCalledTimes(1);
		expect(
			JSON.stringify(vi.mocked(Sentry.captureException).mock.calls),
		).not.toContain("secret");
	});
});

describe("useSingleCeremony", () => {
	it("joins a second call instead of starting another ceremony", async () => {
		const deferred = Promise.withResolvers<string>();
		const ceremony = vi.fn(() => deferred.promise);
		const { result } = renderHook(() => useSingleCeremony(ceremony));

		const first = result.current();
		const second = result.current();
		deferred.resolve("done");

		await expect(first).resolves.toBe("done");
		await expect(second).resolves.toBe("done");
		expect(ceremony).toHaveBeenCalledTimes(1);
	});

	it("starts a new ceremony once the previous one settles", async () => {
		const ceremony = vi.fn(() => Promise.resolve("done"));
		const { result } = renderHook(() => useSingleCeremony(ceremony));

		await result.current();
		await result.current();

		expect(ceremony).toHaveBeenCalledTimes(2);
	});

	it("cancels a running ceremony on unmount", async () => {
		browser.startRegistration.mockReturnValue(new Promise(() => {}));
		const { result, unmount } = renderHook(() =>
			useSingleCeremony(() => createPasskey({} as never)),
		);

		result.current();
		await vi.waitFor(() =>
			expect(browser.startRegistration).toHaveBeenCalled(),
		);
		unmount();

		expect(browser.cancelCeremony).toHaveBeenCalledTimes(1);
	});

	it("does not cancel anything on unmount when idle", () => {
		const { unmount } = renderHook(() =>
			useSingleCeremony(() => Promise.resolve()),
		);

		unmount();

		expect(browser.cancelCeremony).not.toHaveBeenCalled();
	});
});

describe("getPasskeyErrorMessage", () => {
	it("stays silent for an aborted ceremony or cancelled step-up challenge", () => {
		const cancelled = new Error("cancelled");
		cancelled.name = "RecentAuthenticationCancelled";

		expect(
			getPasskeyErrorMessage(new PasskeyCeremonyError("cancelled", "x")),
		).toBeNull();
		expect(getPasskeyErrorMessage(cancelled)).toBeNull();
	});

	it("shows a server refusal but not an unexpected error's message", () => {
		const refusal = new Error("This passkey is already registered.");
		refusal.name = "ClientError";

		expect(getPasskeyErrorMessage(refusal)).toBe(
			"This passkey is already registered.",
		);
		expect(getPasskeyErrorMessage(new Error("relation does not exist"))).toBe(
			"Something went wrong. Try again.",
		);
	});
});
