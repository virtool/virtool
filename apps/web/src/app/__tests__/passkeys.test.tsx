import { act, render, renderHook, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
	addPasskey: vi.fn(),
	browserSupportsAutofill: vi.fn(),
	cancelCeremony: vi.fn(),
	signInPasskey: vi.fn(),
}));

vi.mock("@app/authClient", () => ({
	authClient: {
		passkey: { addPasskey: client.addPasskey },
		signIn: { passkey: client.signInPasskey },
	},
}));

vi.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthnAutofill: client.browserSupportsAutofill,
	WebAuthnAbortService: { cancelCeremony: client.cancelCeremony },
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

import * as Sentry from "@sentry/tanstackstart-react";
import {
	SESSION_NOT_FRESH_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { usePasskeySupport } from "../passkeySupport";
import {
	addPasskey,
	getPasskeyNotice,
	PasskeyCeremonyError,
	signInWithPasskey,
	signInWithPasskeyAutofill,
	useSingleCeremony,
} from "../passkeys";

function failure(
	status: number,
	code?: string,
	message = "https://virtool.test",
) {
	return { data: null, error: { code, message, status, statusText: "" } };
}

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

describe("signInWithPasskeyAutofill", () => {
	it("does not start a ceremony where the browser has no autofill", async () => {
		client.browserSupportsAutofill.mockResolvedValue(false);

		await expect(signInWithPasskeyAutofill()).resolves.toBe(false);
		expect(client.signInPasskey).not.toHaveBeenCalled();
	});

	it("resolves true when an autofilled passkey signs the user in", async () => {
		client.browserSupportsAutofill.mockResolvedValue(true);
		client.signInPasskey.mockResolvedValue({ data: {}, error: null });

		await expect(signInWithPasskeyAutofill()).resolves.toBe(true);
		expect(client.signInPasskey).toHaveBeenCalledWith({ autoFill: true });
	});

	it.each([
		"ERROR_CEREMONY_ABORTED",
		"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
		"AUTH_CANCELLED",
	])("stops quietly on %s", async (code) => {
		client.browserSupportsAutofill.mockResolvedValue(true);
		client.signInPasskey.mockResolvedValue(failure(400, code));

		await expect(signInWithPasskeyAutofill()).resolves.toBe(false);
	});

	it("rejects with the sign-in failure when the server refuses", async () => {
		client.browserSupportsAutofill.mockResolvedValue(true);
		client.signInPasskey.mockResolvedValue(failure(401, "INVALID_CREDENTIALS"));

		const caught = await signInWithPasskeyAutofill().catch((err) => err);

		expect(caught).toBeInstanceOf(PasskeyCeremonyError);
		expect(caught.kind).toBe("failed");
	});
});

describe("signInWithPasskey", () => {
	it("resolves when Better Auth signs the user in", async () => {
		client.signInPasskey.mockResolvedValue({ data: {}, error: null });

		await expect(signInWithPasskey()).resolves.toBeUndefined();
	});

	it.each([
		[400, "ERROR_CEREMONY_ABORTED", "cancelled"],
		[400, "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "incomplete"],
		[400, "ERROR_INVALID_DOMAIN", "unsupported"],
		[400, "USER_VERIFICATION_REQUIRED", "failed"],
		[401, "PASSKEY_NOT_FOUND", "failed"],
		[429, undefined, "failed"],
	])("maps a %i %s to %s", async (status, code, kind) => {
		client.signInPasskey.mockResolvedValue(failure(status, code));

		const caught = await signInWithPasskey().catch((err) => err);

		expect(caught).toBeInstanceOf(PasskeyCeremonyError);
		expect(caught.kind).toBe(kind);
		expect(caught.message).not.toContain("virtool.test");
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it.each([
		[400, "USER_VERIFICATION_REQUIRED"],
		[401, "INVALID_CREDENTIALS"],
		[400, "CHALLENGE_NOT_FOUND"],
	])("gives a %i %s the generic sign-in failure", async (status, code) => {
		client.signInPasskey.mockResolvedValue(failure(status, code));

		expect(
			getPasskeyNotice(await signInWithPasskey().catch((err) => err)),
		).toEqual({
			message:
				"Passkey sign-in failed. Try again or sign in with your password.",
			tone: "error",
		});
	});

	it("asks the user to wait after too many attempts", async () => {
		client.signInPasskey.mockResolvedValue(failure(429));

		expect(
			getPasskeyNotice(await signInWithPasskey().catch((err) => err)),
		).toEqual({
			message: "Too many sign-in attempts. Wait and try again.",
			tone: "error",
		});
	});

	it("reports an unexpected failure without the raw message", async () => {
		client.signInPasskey.mockResolvedValue(
			failure(400, "AUTH_CANCELLED", "clientDataJSON=secret"),
		);

		const caught = await signInWithPasskey().catch((err) => err);

		expect(caught.kind).toBe("failed");
		expect(Sentry.captureException).toHaveBeenCalledTimes(1);
		expect(
			JSON.stringify(vi.mocked(Sentry.captureException).mock.calls),
		).not.toContain("secret");
	});
});

describe("addPasskey", () => {
	it("names the new passkey", async () => {
		client.addPasskey.mockResolvedValue({ data: {}, error: null });

		await addPasskey("Alice");

		expect(client.addPasskey).toHaveBeenCalledWith({ name: "Alice" });
	});

	it("asks for recent authentication when the session is stale", async () => {
		client.addPasskey.mockResolvedValue(failure(403, "SESSION_NOT_FRESH"));

		const caught = await addPasskey("Alice").catch((err) => err);

		expect(caught).toMatchObject({
			name: SESSION_NOT_FRESH_ERROR_NAME,
			operation: "passkey.register",
		});
	});

	it("ends the session when Better Auth no longer knows it", async () => {
		client.addPasskey.mockResolvedValue(failure(401, "UNAUTHORIZED"));

		const caught = await addPasskey("Alice").catch((err) => err);

		expect(caught.name).toBe(UNAUTHORIZED_ERROR_NAME);
	});

	it.each([
		[400, "PASSKEY_ALREADY_REGISTERED"],
		[400, "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"],
	])("says a %i %s is already registered", async (status, code) => {
		client.addPasskey.mockResolvedValue(failure(status, code));

		expect(
			getPasskeyNotice(await addPasskey("Alice").catch((err) => err)),
		).toEqual({
			message: "This passkey is already registered.",
			tone: "error",
		});
	});

	it("gives each ceremony its own neutral notice for a NotAllowedError", async () => {
		const notAllowed = failure(400, "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY");
		client.addPasskey.mockResolvedValue(notAllowed);
		client.signInPasskey.mockResolvedValue(notAllowed);

		const [registration, assertion] = await Promise.all([
			addPasskey("Alice").catch((err) => err),
			signInWithPasskey().catch((err) => err),
		]);

		expect(getPasskeyNotice(registration)).toEqual({
			message: "The passkey was not added. Try again.",
			tone: "neutral",
		});
		expect(getPasskeyNotice(assertion)).toEqual({
			message:
				"Passkey sign-in did not finish. Try again, or sign in with your password.",
			tone: "neutral",
		});
	});

	it("reports an unexpected failure without the raw message", async () => {
		client.addPasskey.mockResolvedValue(
			failure(500, "UNKNOWN_ERROR", "clientDataJSON=secret"),
		);

		const caught = await addPasskey("Alice").catch((err) => err);

		expect(getPasskeyNotice(caught)).toEqual({
			message: "The passkey could not be registered. Try again.",
			tone: "error",
		});
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
		const { result, unmount } = renderHook(() => useSingleCeremony(addPasskey));

		result.current("Alice");
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

describe("getPasskeyNotice", () => {
	it("stays silent for an aborted ceremony or cancelled step-up challenge", () => {
		const cancelled = new Error("cancelled");
		cancelled.name = "RecentAuthenticationCancelled";

		expect(
			getPasskeyNotice(new PasskeyCeremonyError("cancelled", "x")),
		).toBeNull();
		expect(getPasskeyNotice(cancelled)).toBeNull();
	});

	it("shows an incomplete ceremony as neutral", () => {
		expect(
			getPasskeyNotice(new PasskeyCeremonyError("incomplete", "Try again.")),
		).toEqual({ message: "Try again.", tone: "neutral" });
	});

	it.each(["duplicate", "unsupported", "failed"] as const)(
		"shows a %s ceremony as an error",
		(kind) => {
			expect(
				getPasskeyNotice(new PasskeyCeremonyError(kind, "Message.")),
			).toEqual({ message: "Message.", tone: "error" });
		},
	);

	it("shows a server refusal but not an unexpected error's message", () => {
		const refusal = new Error("This passkey is already registered.");
		refusal.name = "ClientError";

		expect(getPasskeyNotice(refusal)).toEqual({
			message: "This passkey is already registered.",
			tone: "error",
		});
		expect(getPasskeyNotice(new Error("relation does not exist"))).toEqual({
			message: "Something went wrong. Try again.",
			tone: "error",
		});
	});
});
