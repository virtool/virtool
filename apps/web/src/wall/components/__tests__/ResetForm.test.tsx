import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	mockGetPasswordPolicy,
	settingsServerFnMocks,
} from "@tests/server-fn/settings";
import { renderWithProviders } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";

const { navigateMock, resetPasswordMock } = vi.hoisted(() => ({
	navigateMock: vi.fn(),
	resetPasswordMock: vi.fn(),
}));

vi.mock("../../queries", async () => {
	const { useMutation } = await import("@tanstack/react-query");
	return {
		useResetPasswordMutation: () =>
			useMutation({
				mutationFn: resetPasswordMock,
			}),
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => navigateMock,
}));

import ResetForm from "../ResetForm";

describe("<ResetForm />", () => {
	afterEach(() => {
		navigateMock.mockReset();
		resetPasswordMock.mockReset();
	});

	it("calls the reset mutation with the form values", async () => {
		const password = "P@ssword123";

		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
		expect(resetPasswordMock).toHaveBeenCalledWith(
			{ password },
			expect.anything(),
		);
	});

	it("displays the thrown error message on reset failure", async () => {
		const password = "P@ssword123";
		const errorMessage = "Cannot reuse current password";

		resetPasswordMock.mockRejectedValue(new Error(errorMessage));

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		expect(await screen.findByText(errorMessage)).toBeInTheDocument();
	});

	it("rejects a password shorter than eight characters without submitting", async () => {
		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), "short12");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		expect(
			await screen.findByText(
				"Password does not meet minimum length requirement (8)",
			),
		).toBeInTheDocument();
		expect(resetPasswordMock).not.toHaveBeenCalled();
	});

	it("rejects a password shorter than the configured minimum without submitting", async () => {
		mockGetPasswordPolicy(12);

		renderWithProviders(<ResetForm />);

		// Eleven characters: long enough for the default minimum, so this only
		// fails if the form is reading the configured one.
		await userEvent.type(screen.getByLabelText("Password"), "elevenchars");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		expect(
			await screen.findByText(
				"Password does not meet minimum length requirement (12)",
			),
		).toBeInTheDocument();
		expect(resetPasswordMock).not.toHaveBeenCalled();
	});

	it("accepts a password shorter than the default when the configured minimum is lower", async () => {
		mockGetPasswordPolicy(4);
		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), "abcd");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
	});

	it("applies no length rule when the policy is unavailable", async () => {
		// The configured minimum can be below the default, so guessing one here
		// would reject a password the server accepts. Defer to the server instead.
		settingsServerFnMocks.getPasswordPolicyFn.mockRejectedValue(
			new Error("policy unavailable"),
		);
		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), "abcd");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
	});

	it("accepts a password that meets the configured minimum", async () => {
		mockGetPasswordPolicy(12);
		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), "twelvechars!");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
	});

	it("navigates to the redirect on a successful reset", async () => {
		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm redirect="/samples" />);

		await userEvent.type(screen.getByLabelText("Password"), "P@ssword123");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({ to: "/samples" }),
		);
	});

	it("navigates to the root when no redirect is provided", async () => {
		resetPasswordMock.mockResolvedValue({ login: false, reset: false });

		renderWithProviders(<ResetForm />);

		await userEvent.type(screen.getByLabelText("Password"), "P@ssword123");
		await userEvent.click(screen.getByRole("button", { name: "Reset" }));

		await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/" }));
	});
});
