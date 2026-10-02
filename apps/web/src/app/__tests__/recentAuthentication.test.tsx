import { useRecentlyAuthenticatedMutation } from "@app/recentAuthentication";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import { wrapWithProviders } from "@tests/setup";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const webauthn = vi.hoisted(() => {
	class WebAuthnError extends Error {
		code: string;

		constructor(code: string) {
			super(code);
			this.code = code;
		}
	}

	return {
		WebAuthnError,
		cancelCeremony: vi.fn(),
		fetch: vi.fn(),
		startAuthentication: vi.fn(),
	};
});

vi.mock("@app/authClient", () => ({
	authClient: { $fetch: webauthn.fetch },
}));

vi.mock("@simplewebauthn/browser", () => ({
	startAuthentication: webauthn.startAuthentication,
	WebAuthnAbortService: { cancelCeremony: webauthn.cancelCeremony },
	WebAuthnError: webauthn.WebAuthnError,
}));

function staleError() {
	return Object.assign(new Error("Recent authentication required"), {
		name: SESSION_NOT_FRESH_ERROR_NAME,
	});
}

function wrapper({ children }: { children: ReactNode }) {
	return wrapWithProviders(children);
}

describe("recent authentication orchestration", () => {
	beforeEach(() => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ passkey: false, password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
	});

	it("preserves variables and retries the original mutation exactly once", async () => {
		const operation = vi
			.fn<(variables: { email: string }) => Promise<string>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce("updated");
		const variables = { email: "alice@example.com" };
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current(variables);
		});
		const password = await screen.findByLabelText("Password");
		expect(
			screen.getByRole("heading", { name: "Confirm your identity" }),
		).toBeVisible();
		expect(password).toHaveFocus();
		await userEvent.type(password, "secret");
		expect(password).toHaveAttribute("type", "password");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(promise).resolves.toBe("updated");
		expect(operation).toHaveBeenCalledTimes(2);
		expect(operation).toHaveBeenNthCalledWith(1, variables);
		expect(operation).toHaveBeenNthCalledWith(2, variables);
	});

	it("shares one challenge among simultaneous mutations", async () => {
		const first = vi
			.fn<(value: number) => Promise<number>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce(1);
		const second = vi
			.fn<(value: number) => Promise<number>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce(2);
		const { result } = renderHook(
			() => ({
				first: useRecentlyAuthenticatedMutation(first),
				second: useRecentlyAuthenticatedMutation(second),
			}),
			{ wrapper },
		);

		let promises: Promise<number>[] = [];
		act(() => {
			promises = [result.current.first(1), result.current.second(2)];
		});
		await userEvent.type(await screen.findByLabelText("Password"), "secret");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(Promise.all(promises)).resolves.toEqual([1, 2]);
		expect(
			recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn,
		).toHaveBeenCalledTimes(1);
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).toHaveBeenCalledTimes(1);
	});

	it("cancels without applying the mutation and clears credentials", async () => {
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValue(staleError());
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let first: Promise<string> | undefined;
		act(() => {
			first = result.current("unchanged");
		});
		const password = await screen.findByLabelText("Password");
		await userEvent.type(password, "secret");
		const firstRejection = expect(first).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await firstRejection;
		expect(operation).toHaveBeenCalledTimes(1);

		let second: Promise<string> | undefined;
		act(() => {
			second = result.current("unchanged");
		});
		await waitFor(() =>
			expect(screen.getByLabelText("Password")).toHaveValue(""),
		);
		const secondRejection = expect(second).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await secondRejection;
	});

	it("clears credentials and does not retry after a terminal provider failure", async () => {
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValueOnce(staleError());
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockRejectedValue(
			new Error("provider unavailable"),
		);
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("unchanged");
		});
		await userEvent.type(await screen.findByLabelText("Password"), "secret");
		const rejection = expect(promise).rejects.toThrow("provider unavailable");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await rejection;
		expect(operation).toHaveBeenCalledTimes(1);
		expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
	});
	it("submits a password without an authenticator code when both methods are enrolled", async () => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ passkey: false, password: true, totp: true },
		);
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce("updated");
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("value");
		});
		const password = await screen.findByLabelText("Password");
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Authenticator code"),
		).not.toBeInTheDocument();
		expect(screen.getByText("Enter your password to continue.")).toBeVisible();
		await userEvent.type(password, "secret");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(promise).resolves.toBe("updated");
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).toHaveBeenCalledWith(
			{ data: { method: "password", password: "secret" } },
			expect.anything(),
		);
	});

	it("switches between password and authenticator code", async () => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ passkey: false, password: true, totp: true },
		);
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce("updated");
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("value");
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Continue" }),
		);
		expect(await screen.findByText("Enter your password.")).toBeVisible();

		await userEvent.type(screen.getByLabelText("Password"), "secret");
		await userEvent.click(
			screen.getByRole("button", {
				name: "Use an authenticator code instead",
			}),
		);
		const code = screen.getByLabelText("Authenticator code");
		expect(code).toHaveFocus();
		expect(code).toHaveAttribute("maxLength", "6");
		expect(code).toHaveAttribute("inputMode", "numeric");
		expect(code).toHaveAttribute("autoComplete", "one-time-code");
		expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
		expect(screen.queryByText("Enter your password.")).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"Enter the code from your authenticator app to continue.",
			),
		).toBeVisible();

		await userEvent.click(
			screen.getByRole("button", { name: "Use your password instead" }),
		);
		const password = screen.getByLabelText("Password");
		expect(password).toHaveFocus();
		expect(password).toHaveValue("");

		await userEvent.click(
			screen.getByRole("button", {
				name: "Use an authenticator code instead",
			}),
		);
		await userEvent.type(screen.getByLabelText("Authenticator code"), "123456");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(promise).resolves.toBe("updated");
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).toHaveBeenCalledWith(
			{ data: { method: "totp", code: "123456" } },
			expect.anything(),
		);
	});

	it("shows no switch link when only one method is enrolled", async () => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ passkey: false, password: false, totp: true },
		);
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValue(staleError());
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("value");
		});
		const code = await screen.findByLabelText("Authenticator code");
		expect(code).toHaveFocus();
		expect(
			screen.queryByRole("button", { name: "Use your password instead" }),
		).not.toBeInTheDocument();

		const rejection = expect(promise).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await rejection;
	});
});

describe("recent authentication with a passkey", () => {
	const OPTIONS = { challenge: "challenge", rpId: "virtool.test" };
	const ASSERTION = {
		id: "credential",
		rawId: "credential",
		type: "public-key",
		response: {
			clientDataJSON: "client-data",
			authenticatorData: "authenticator-data",
			signature: "signature",
		},
		clientExtensionResults: { credProps: { rk: true } },
	};

	function mockMethods(methods: {
		passkey: boolean;
		password: boolean;
		totp: boolean;
	}) {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			methods,
		);
	}

	function startChallenge() {
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce("updated");
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);
		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("value");
		});
		return { operation, promise: promise as Promise<string> };
	}

	beforeEach(() => {
		for (const mock of [
			webauthn.cancelCeremony,
			webauthn.fetch,
			webauthn.startAuthentication,
		]) {
			mock.mockReset();
		}
		vi.stubGlobal("isSecureContext", true);
		vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
		webauthn.fetch.mockResolvedValue({ data: OPTIONS, error: null });
		webauthn.startAuthentication.mockResolvedValue(ASSERTION);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("offers a passkey above the password without starting the ceremony", async () => {
		mockMethods({ passkey: true, password: true, totp: true });
		const { promise } = startChallenge();

		const passkey = await screen.findByRole("button", {
			name: "Continue with a passkey",
		});
		const password = screen.getByLabelText("Password");

		expect(
			passkey.compareDocumentPosition(password) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Use an authenticator code instead" }),
		).toBeVisible();
		expect(webauthn.fetch).not.toHaveBeenCalled();
		expect(webauthn.startAuthentication).not.toHaveBeenCalled();

		const rejection = expect(promise).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await rejection;
	});

	it("verifies with a passkey and retries the mutation", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		const { operation, promise } = startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		await expect(promise).resolves.toBe("updated");
		expect(operation).toHaveBeenCalledTimes(2);
		expect(webauthn.fetch).toHaveBeenCalledWith(
			"/virtool-session/passkey-options",
			{ method: "GET", throw: false },
		);
		expect(webauthn.startAuthentication).toHaveBeenCalledWith({
			optionsJSON: OPTIONS,
		});
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).toHaveBeenCalledWith({
			data: {
				method: "passkey",
				response: { ...ASSERTION, clientExtensionResults: {} },
			},
		});
	});

	it("shows a pending state while the passkey is in use", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		const authentication = Promise.withResolvers<typeof ASSERTION>();
		webauthn.startAuthentication.mockReturnValue(authentication.promise);
		const { promise } = startChallenge();
		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		expect(
			await screen.findByRole("button", { name: "Waiting for your passkey…" }),
		).toBeDisabled();
		expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

		authentication.resolve(ASSERTION);
		await expect(promise).resolves.toBe("updated");
	});

	it("cancels a running ceremony when the challenge is cancelled", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		webauthn.startAuthentication.mockReturnValue(new Promise(() => {}));
		const { promise } = startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);
		await screen.findByRole("button", { name: "Waiting for your passkey…" });
		const rejection = expect(promise).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

		await rejection;
		await waitFor(() => expect(webauthn.cancelCeremony).toHaveBeenCalled());
	});

	it("explains a rate-limited passkey request", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		webauthn.fetch.mockResolvedValue({
			data: null,
			error: { status: 429, statusText: "Too Many Requests" },
		});
		startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		expect(
			await screen.findByText("Too many attempts. Wait and try again."),
		).toHaveAttribute("role", "alert");
		expect(webauthn.startAuthentication).not.toHaveBeenCalled();
	});

	it("shows a neutral notice when the passkey ceremony does not finish", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		webauthn.startAuthentication.mockRejectedValue(
			new webauthn.WebAuthnError("ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"),
		);
		const { operation } = startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Passkey verification did not finish. Try again.",
		);
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).not.toHaveBeenCalled();
		expect(operation).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole("button", { name: "Continue with a passkey" }),
		).toBeEnabled();
	});

	it("shows an error when the server refuses the passkey", async () => {
		mockMethods({ passkey: true, password: true, totp: false });
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockRejectedValue(
			Object.assign(new Error("Authentication challenge failed."), {
				status: 400,
			}),
		);
		startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		expect(
			await screen.findByText("Your passkey could not be verified. Try again."),
		).toHaveAttribute("role", "alert");
		expect(screen.getByLabelText("Password")).toBeVisible();
	});

	it("shows only the passkey for an account without a password or code", async () => {
		mockMethods({ passkey: true, password: false, totp: false });
		const { promise } = startChallenge();

		await userEvent.click(
			await screen.findByRole("button", { name: "Continue with a passkey" }),
		);

		await expect(promise).resolves.toBe("updated");
		expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
	});

	it("hides the passkey where the browser cannot use one", async () => {
		vi.stubGlobal("PublicKeyCredential", undefined);
		mockMethods({ passkey: true, password: true, totp: false });
		const { promise } = startChallenge();

		expect(await screen.findByLabelText("Password")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Continue with a passkey" }),
		).not.toBeInTheDocument();

		const rejection = expect(promise).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await rejection;
	});

	it("explains a passkey-only account in a browser that cannot use one", async () => {
		vi.stubGlobal("PublicKeyCredential", undefined);
		mockMethods({ passkey: true, password: false, totp: false });
		const { promise } = startChallenge();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This browser cannot use a passkey.",
		);

		const rejection = expect(promise).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await rejection;
	});
});
