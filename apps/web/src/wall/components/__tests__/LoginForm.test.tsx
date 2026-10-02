import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createClientError } from "@tests/server-fn/auth";
import {
	mockGetAccount,
	mockGetAccountMfaEnrollmentRequired,
	userServerFnMocks,
} from "@tests/server-fn/users";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import {
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
} from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	autofillSupportMock,
	loginMock,
	navigateMock,
	passkeyMock,
	verifyMock,
} = vi.hoisted(() => ({
	autofillSupportMock: vi.fn(),
	loginMock: vi.fn(),
	navigateMock: vi.fn(),
	passkeyMock: vi.fn(),
	verifyMock: vi.fn(),
}));

vi.mock("@app/authClient", () => ({
	authClient: { signIn: { passkey: passkeyMock } },
}));

vi.mock("@simplewebauthn/browser", () => ({
	browserSupportsWebAuthnAutofill: autofillSupportMock,
	WebAuthnAbortService: { cancelCeremony: vi.fn() },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => navigateMock,
}));

vi.mock("../../queries", async (importOriginal) => {
	const { useMutation } = await import("@tanstack/react-query");
	const { usePasskeySignInMutation } =
		await importOriginal<typeof import("../../queries")>();
	return {
		useVerifyTwoFactorMutation: () => useMutation({ mutationFn: verifyMock }),
		useLoginMutation: () =>
			useMutation({
				mutationFn: loginMock,
			}),
		usePasskeySignInMutation,
	};
});

function passkeyFailure(status: number, code?: string) {
	return {
		data: null,
		error: { code, message: "https://virtool.test", status, statusText: "" },
	};
}

function rejectAccount(name: string, purpose?: string) {
	userServerFnMocks.getAccountFn.mockRejectedValue(
		Object.assign(new Error(name), { name, purpose }),
	);
}

function stubPasskeySupport(available: boolean) {
	vi.stubGlobal("isSecureContext", available);
	vi.stubGlobal(
		"PublicKeyCredential",
		available ? function PublicKeyCredential() {} : undefined,
	);
}

import LoginForm from "../LoginForm";

describe("<LoginForm />", () => {
	beforeEach(() => {
		autofillSupportMock.mockResolvedValue(false);
		mockGetAccount(createFakeAccount());
	});

	afterEach(() => {
		autofillSupportMock.mockReset();
		loginMock.mockReset();
		navigateMock.mockReset();
		passkeyMock.mockReset();
		verifyMock.mockReset();
		vi.unstubAllGlobals();
	});

	it("carries the redirect into email remediation", async () => {
		loginMock.mockResolvedValue({ remediation: true, reset: false });
		rejectAccount(SETUP_REQUIRED_ERROR_NAME, "email_remediation");
		const setResetRequired = vi.fn();

		renderWithProviders(
			<MemoryRouter>
				<LoginForm redirect="/samples" setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				to: "/email-remediation",
				search: { redirect: "/samples" },
				replace: true,
			}),
		);
	});

	it("calls the login mutation with the form values", async () => {
		const user = userEvent.setup();
		const handle = "test_Username";
		const password = "Password";
		const setResetRequired = vi.fn();

		loginMock.mockResolvedValue({ reset: false });

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await user.type(await screen.findByLabelText("Username"), handle);
		await user.type(screen.getByLabelText("Password"), password);
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
		expect(loginMock).toHaveBeenCalledWith(
			{
				handle,
				password,
			},
			expect.anything(),
		);
	});

	it("displays the thrown error message on login failure", async () => {
		const user = userEvent.setup();
		const handle = "test_Username";
		const password = "Password";
		const errorMessage = "Invalid handle or password.";
		const setResetRequired = vi.fn();

		loginMock.mockRejectedValue(createClientError(errorMessage));

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await user.type(await screen.findByLabelText("Username"), handle);
		await user.type(screen.getByLabelText("Password"), password);
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText(errorMessage)).toBeInTheDocument();
	});

	it("continues a two-factor challenge and handles forced reset only after verification", async () => {
		const user = userEvent.setup();
		loginMock.mockResolvedValue({ twoFactorRedirect: true });
		verifyMock.mockRejectedValueOnce(
			createClientError("Invalid or expired verification code."),
		);
		verifyMock.mockResolvedValueOnce({ reset: true });
		rejectAccount(PASSWORD_RESET_REQUIRED_ERROR_NAME);
		const setResetRequired = vi.fn();
		renderWithProviders(
			<MemoryRouter>
				<LoginForm redirect="/samples" setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);
		await user.type(await screen.findByLabelText("Username"), "Alice");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		await user.type(
			await screen.findByLabelText("Authentication code"),
			"123456",
		);
		expect(setResetRequired).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "Verify" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Invalid or expired",
		);
		expect(verifyMock).toHaveBeenCalledWith(
			{ code: "123456", recovery: false },
			expect.anything(),
		);
		await user.click(screen.getByRole("button", { name: "Use recovery code" }));
		await user.type(
			await screen.findByLabelText("Recovery code"),
			"backup-code",
		);
		await user.click(screen.getByRole("button", { name: "Verify" }));
		await waitFor(() => expect(setResetRequired).toHaveBeenCalledWith(true));
		expect(verifyMock).toHaveBeenLastCalledWith(
			{ code: "backup-code", recovery: true },
			expect.anything(),
		);
	});

	it("hides an unexpected error behind a generic message", async () => {
		loginMock.mockRejectedValue(new Error("BETTER_AUTH internal detail"));

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={vi.fn()} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Sign-in failed. Try again.");
		expect(alert).not.toHaveTextContent("BETTER_AUTH");
	});

	it("sends a user who must turn on two-factor authentication to enrollment", async () => {
		loginMock.mockResolvedValue({ reset: false });
		mockGetAccountMfaEnrollmentRequired();

		renderWithProviders(
			<MemoryRouter>
				<LoginForm redirect="/samples" setResetRequired={vi.fn()} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				to: "/mfa-enrollment",
				search: { redirect: "/samples" },
				replace: true,
			}),
		);
	});

	it("uses a numeric field for the authenticator code", async () => {
		loginMock.mockResolvedValue({ twoFactorRedirect: true });

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={vi.fn()} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		const field = await screen.findByLabelText("Authentication code");
		expect(field).toHaveAttribute("inputmode", "numeric");
		expect(field).toHaveAttribute("autocomplete", "one-time-code");

		await userEvent.type(field, "12ab");
		await userEvent.click(screen.getByRole("button", { name: "Verify" }));
		expect(
			await screen.findByText("Enter the 6-digit code"),
		).toBeInTheDocument();
		expect(verifyMock).not.toHaveBeenCalled();
	});

	it("returns from the challenge to the sign-in form", async () => {
		loginMock.mockResolvedValue({ twoFactorRedirect: true });

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={vi.fn()} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Back to sign in" }),
		);

		expect(
			await screen.findByRole("button", { name: "Sign in" }),
		).toBeInTheDocument();
	});

	describe("passkey sign-in", () => {
		it("offers passkeys in the username autofill", async () => {
			stubPasskeySupport(true);
			autofillSupportMock.mockResolvedValue(true);
			passkeyMock.mockResolvedValue({ data: {}, error: null });

			renderWithProviders(
				<MemoryRouter>
					<LoginForm redirect="/samples" setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			expect(await screen.findByLabelText("Username")).toHaveAttribute(
				"autocomplete",
				"username webauthn",
			);
			await waitFor(() =>
				expect(passkeyMock).toHaveBeenCalledWith({ autoFill: true }),
			);
			await waitFor(() =>
				expect(navigateMock).toHaveBeenCalledWith({
					to: "/samples",
					replace: true,
				}),
			);
		});

		it("does not start autofill where the browser has none", async () => {
			stubPasskeySupport(true);

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await waitFor(() => expect(autofillSupportMock).toHaveBeenCalled());
			expect(passkeyMock).not.toHaveBeenCalled();
			expect(screen.queryByRole("alert")).toBeNull();
		});

		it("signs in and follows the redirect", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockResolvedValue({ data: {}, error: null });

			renderWithProviders(
				<MemoryRouter>
					<LoginForm redirect="/samples" setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);

			await waitFor(() =>
				expect(navigateMock).toHaveBeenCalledWith({
					to: "/samples",
					replace: true,
				}),
			);
		});

		it("blocks password sign-in while a passkey request is pending", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockReturnValue(new Promise(() => {}));

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);
			await userEvent.type(screen.getByLabelText("Username"), "Alice");
			await userEvent.type(
				screen.getByLabelText("Password"),
				"password{enter}",
			);

			expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
			expect(loginMock).not.toHaveBeenCalled();
		});

		it("blocks passkey sign-in while a password request is pending", async () => {
			stubPasskeySupport(true);
			loginMock.mockReturnValue(new Promise(() => {}));

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.type(await screen.findByLabelText("Username"), "Alice");
			await userEvent.type(screen.getByLabelText("Password"), "password");
			await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: "Sign in with a passkey" }),
				).toBeDisabled(),
			);
			expect(passkeyMock).not.toHaveBeenCalled();
		});

		it("says nothing when the user cancels and keeps the password form usable", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockResolvedValue(
				passkeyFailure(400, "ERROR_CEREMONY_ABORTED"),
			);
			loginMock.mockResolvedValue({ reset: false });

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);
			await waitFor(() => expect(passkeyMock).toHaveBeenCalled());
			expect(screen.queryByRole("alert")).toBeNull();

			await userEvent.type(screen.getByLabelText("Username"), "Alice");
			await userEvent.type(screen.getByLabelText("Password"), "password");
			await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() =>
				expect(navigateMock).toHaveBeenCalledWith({ to: "/", replace: true }),
			);
		});

		it("shows an incomplete ceremony as a neutral notice", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockResolvedValue(
				passkeyFailure(400, "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"),
			);

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);

			const notice = await screen.findByRole("status");
			expect(notice).toHaveTextContent("Passkey sign-in did not finish");
			expect(notice).toHaveClass("text-gray-600");
			expect(screen.queryByRole("alert")).toBeNull();
		});

		it("shows the generic failure for a server refusal", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockResolvedValue(passkeyFailure(401, "INVALID_CREDENTIALS"));

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(
				"Passkey sign-in failed. Try again or sign in with your password.",
			);
			expect(alert).not.toHaveTextContent("virtool.test");
			expect(alert).toHaveClass("text-red-600");
		});

		it("asks the user to wait after too many attempts", async () => {
			stubPasskeySupport(true);
			passkeyMock.mockResolvedValue(passkeyFailure(429));

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			await userEvent.click(
				await screen.findByRole("button", { name: "Sign in with a passkey" }),
			);

			expect(await screen.findByRole("alert")).toHaveTextContent(
				"Too many sign-in attempts. Wait and try again.",
			);
		});

		it("explains when the browser cannot use passkeys", async () => {
			stubPasskeySupport(false);

			renderWithProviders(
				<MemoryRouter>
					<LoginForm setResetRequired={vi.fn()} />
				</MemoryRouter>,
			);

			expect(
				await screen.findByText(
					"Passkey sign-in is not available in this browser.",
				),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Sign in with a passkey" }),
			).toBeNull();
			expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
		});
	});
});
