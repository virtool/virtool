import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loginMock, navigateMock, verifyMock } = vi.hoisted(() => ({
	loginMock: vi.fn(),
	navigateMock: vi.fn(),
	verifyMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => navigateMock,
}));

vi.mock("../../queries", async () => {
	const { useMutation } = await import("@tanstack/react-query");
	return {
		useVerifyTwoFactorMutation: () => useMutation({ mutationFn: verifyMock }),
		useLoginMutation: () =>
			useMutation({
				mutationFn: loginMock,
			}),
	};
});

import LoginForm from "../LoginForm";

describe("<LoginForm />", () => {
	afterEach(() => {
		loginMock.mockReset();
		navigateMock.mockReset();
		verifyMock.mockReset();
	});

	it("carries the redirect into email remediation", async () => {
		loginMock.mockResolvedValue({ remediation: true, reset: false });
		const setResetRequired = vi.fn();

		renderWithProviders(
			<MemoryRouter>
				<LoginForm redirect="/samples" setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), "Alice");
		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				to: "/email-remediation",
				search: { redirect: "/samples" },
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
		await user.click(screen.getByRole("button", { name: "Login" }));

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

		loginMock.mockRejectedValue(new Error(errorMessage));

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await user.type(await screen.findByLabelText("Username"), handle);
		await user.type(screen.getByLabelText("Password"), password);
		await user.click(screen.getByRole("button", { name: "Login" }));

		expect(await screen.findByText(errorMessage)).toBeInTheDocument();
	});

	it("continues a two-factor challenge and handles forced reset only after verification", async () => {
		const user = userEvent.setup();
		loginMock.mockResolvedValue({ twoFactorRedirect: true });
		verifyMock.mockRejectedValueOnce(
			new Error("Invalid or expired verification code."),
		);
		verifyMock.mockResolvedValueOnce({ reset: true });
		const setResetRequired = vi.fn();
		renderWithProviders(
			<MemoryRouter>
				<LoginForm redirect="/samples" setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);
		await user.type(await screen.findByLabelText("Username"), "Alice");
		await user.type(screen.getByLabelText("Password"), "password");
		await user.click(screen.getByRole("button", { name: "Login" }));
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
});
