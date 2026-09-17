import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loginMock, verifyMock } = vi.hoisted(() => ({
	loginMock: vi.fn(),
	verifyMock: vi.fn(),
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
		verifyMock.mockReset();
	});

	it("calls the login mutation with the form values", async () => {
		const handle = "test_Username";
		const password = "Password";
		const setResetRequired = vi.fn();

		loginMock.mockResolvedValue({ reset: false });

		renderWithProviders(
			<MemoryRouter>
				<LoginForm setResetRequired={setResetRequired} />
			</MemoryRouter>,
		);

		await userEvent.type(await screen.findByLabelText("Username"), handle);
		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Login" }));

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

		await userEvent.type(await screen.findByLabelText("Username"), handle);
		await userEvent.type(screen.getByLabelText("Password"), password);
		await userEvent.click(screen.getByRole("button", { name: "Login" }));

		expect(await screen.findByText(errorMessage)).toBeInTheDocument();
	});
});

it("continues a two-factor challenge and handles forced reset only after verification", async () => {
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
	await userEvent.type(await screen.findByLabelText("Username"), "Alice");
	await userEvent.type(screen.getByLabelText("Password"), "password");
	await userEvent.click(screen.getByRole("button", { name: "Login" }));
	await userEvent.type(
		await screen.findByLabelText("Authentication code"),
		"123456",
	);
	expect(setResetRequired).not.toHaveBeenCalled();
	await userEvent.click(screen.getByRole("button", { name: "Verify" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Invalid or expired",
	);
	expect(verifyMock).toHaveBeenCalledWith(
		{ code: "123456", recovery: false },
		expect.anything(),
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Use recovery code" }),
	);
	await userEvent.type(screen.getByLabelText("Recovery code"), "backup-code");
	await userEvent.click(screen.getByRole("button", { name: "Verify" }));
	await waitFor(() => expect(setResetRequired).toHaveBeenCalledWith(true));
	expect(verifyMock).toHaveBeenLastCalledWith(
		{ code: "backup-code", recovery: true },
		expect.anything(),
	);
});
